import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { RagService } from "../services/rag/rag.service.js";

const chatHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().max(8000),
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
    "listing_inquiry", "damage_inquiry", "policy_question", "negotiation_inquiry", "payment_escrow_inquiry", "general_faq",
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
});

const conciergeQuerySchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(2000, "Message too long"),
  history: z.array(chatHistoryMessageSchema).max(30).optional(),
  date: z.string().optional(),
  location: z.string().optional(),
  quantity: z.number().int().positive().optional(),
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

      const ragResponse = await RagService.processQuery({
        message: parsedBody.message,
        history: parsedBody.history,
        date: parsedBody.date,
        location: parsedBody.location,
        quantity: parsedBody.quantity,
        context: parsedBody.context,
      });

      res.status(200).json({
        success: true,
        data: ragResponse,
      });
    } catch (error) {
      next(error);
    }
  }
}
