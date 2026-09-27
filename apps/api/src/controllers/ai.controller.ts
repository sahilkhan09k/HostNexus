import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { RagService } from "../services/rag/rag.service.js";
import { signReply, verifyReply } from "../utils/reply-signature.js";

const chatHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().max(20000),
  listingIds: z.array(z.string().max(64)).max(20).optional(),
  /** HMAC returned with each assistant reply; unsigned assistant turns are dropped */
  signature: z.string().max(128).optional(),
});

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Conversation memory echoed back by the chat. It only holds search criteria
 * and ids of public listings, so a tampered copy can't do more than change the
 * search; it is still bounded and validated.
 */
const conciergeContextSchema = z.object({
  v: z.literal(1),
  lastIntent: z.enum([
    "listing_inquiry", "damage_inquiry", "policy_question", "negotiation_inquiry", "payment_escrow_inquiry",
    "weather_inquiry", "general_faq",
  ]).optional(),
  lastUserMessage: z.string().max(2000).optional(),
  search: z.object({
    items: z.array(z.object({
      key: z.string().max(60),
      quantity: z.number().int().positive().max(1_000_000).optional(),
      inferred: z.boolean().optional(),
    })).max(10),
    guests: z.number().int().positive().max(1_000_000).optional(),
    location: z.object({ label: z.string().max(80), city: z.string().max(60).optional() }).optional(),
    budget: z.object({
      amountPaise: z.number().int().positive().max(1e13),
      basis: z.enum(["total", "per_day"]),
      perUnit: z.boolean(),
    }).optional(),
    startDate: isoDay.optional(),
    endDate: isoDay.optional(),
  }).optional(),
  resultIds: z.array(z.string().max(40)).max(20).optional(),
  weather: z.object({
    location: z.object({ label: z.string().max(80), city: z.string().max(60).optional() }),
    startDate: isoDay.optional(),
    endDate: isoDay.optional(),
  }).optional(),
});

const conciergeQuerySchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(2000, "Message too long"),
  history: z.array(chatHistoryMessageSchema).max(50).optional(),
  date: z.string().max(40).optional(),
  location: z.string().max(100).optional(),
  quantity: z.number().int().positive().max(100000).optional(),
  context: conciergeContextSchema.optional(),
});

export class AiController {
  /**
   * Process a query through the HostNexus RAG Concierge Pipeline
   * POST /api/ai/concierge
   */
  static async handleConciergeQuery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = conciergeQuerySchema.parse(req.body);

      // Only user turns and assistant turns we actually produced may reach the model
      const history = parsedBody.history
        ?.filter((m) => m.role === "user" || (m.role === "assistant" && verifyReply(m.content, m.listingIds, m.signature)))
        .map(({ role, content, listingIds }) => ({ role, content, listingIds }));

      const ragResponse = await RagService.processQuery({
        message: parsedBody.message,
        history,
        date: parsedBody.date,
        location: parsedBody.location,
        quantity: parsedBody.quantity,
        context: parsedBody.context,
      });

      res.status(200).json({
        success: true,
        data: {
          ...ragResponse,
          replySignature: signReply(ragResponse.reply, ragResponse.results.map((r) => r.id)),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
