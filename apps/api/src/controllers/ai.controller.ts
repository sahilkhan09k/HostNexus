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

const conciergeQuerySchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(2000, "Message too long"),
  history: z.array(chatHistoryMessageSchema).max(50).optional(),
  date: z.string().max(40).optional(),
  location: z.string().max(100).optional(),
  quantity: z.number().int().positive().max(100000).optional(),
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
