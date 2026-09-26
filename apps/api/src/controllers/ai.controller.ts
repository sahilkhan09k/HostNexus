import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { RagService } from "../services/rag/rag.service.js";

const chatHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const conciergeQuerySchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(2000, "Message too long"),
  history: z.array(chatHistoryMessageSchema).optional(),
  date: z.string().optional(),
  location: z.string().optional(),
  quantity: z.number().int().positive().optional(),
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
