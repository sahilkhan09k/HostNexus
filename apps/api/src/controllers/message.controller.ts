import type { Request, Response, NextFunction } from "express";
import { MessageService } from "../services/message.service.js";
import { BusinessService } from "../services/business.service.js";

export class MessageController {
  /**
   * GET /api/messages — get all conversations for the current user's business
   */
  static async getConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const business = await BusinessService.getBusinessByUserId(userId);
      if (!business) {
        res.status(403).json({ success: false, error: { code: "NO_BUSINESS", message: "No business found for this user" } });
        return;
      }

      const conversations = await MessageService.getConversations(business.id);
      res.status(200).json({ success: true, data: { conversations } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/messages/:conversationId — get messages in a conversation
   */
  static async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const business = await BusinessService.getBusinessByUserId(userId);
      if (!business) {
        res.status(403).json({ success: false, error: { code: "NO_BUSINESS", message: "No business found for this user" } });
        return;
      }

      const { conversationId } = req.params;
      const messages = await MessageService.getMessages(String(conversationId), business.id);
      res.status(200).json({ success: true, data: { messages } });
    } catch (error) {
      if (error instanceof Error && error.message === "Conversation not found") {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Conversation not found" } });
        return;
      }
      next(error);
    }
  }

  /**
   * POST /api/messages/:conversationId — send a message in a conversation
   */
  static async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const business = await BusinessService.getBusinessByUserId(userId);
      if (!business) {
        res.status(403).json({ success: false, error: { code: "NO_BUSINESS", message: "No business found for this user" } });
        return;
      }

      const { conversationId } = req.params;
      const { content } = req.body as { content?: string };

      if (!content || typeof content !== "string" || content.trim().length === 0) {
        res.status(400).json({ success: false, error: { code: "INVALID_CONTENT", message: "Message content is required" } });
        return;
      }

      const message = await MessageService.sendMessage(String(conversationId), business.id, content.trim());
      res.status(201).json({ success: true, data: { message } });
    } catch (error) {
      if (error instanceof Error && error.message === "Conversation not found") {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Conversation not found" } });
        return;
      }
      next(error);
    }
  }

  /**
   * POST /api/messages/conversations — start or retrieve a conversation with another business
   */
  static async startConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const business = await BusinessService.getBusinessByUserId(userId);
      if (!business) {
        res.status(403).json({ success: false, error: { code: "NO_BUSINESS", message: "No business found for this user" } });
        return;
      }

      const { otherBusinessId } = req.body as { otherBusinessId?: string };
      if (!otherBusinessId || typeof otherBusinessId !== "string") {
        res.status(400).json({ success: false, error: { code: "INVALID_INPUT", message: "otherBusinessId is required" } });
        return;
      }

      if (otherBusinessId === business.id) {
        res.status(400).json({ success: false, error: { code: "INVALID_INPUT", message: "Cannot start a conversation with yourself" } });
        return;
      }

      const otherBusiness = await BusinessService.getBusinessById(otherBusinessId);
      if (!otherBusiness) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Other business not found" } });
        return;
      }

      const conversation = await MessageService.getOrCreateConversation(business.id, otherBusinessId);
      res.status(200).json({ success: true, data: { conversation } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/messages/unread — get total unread message count for the current user's business
   */
  static async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "User not authenticated" } });
        return;
      }

      const business = await BusinessService.getBusinessByUserId(userId);
      if (!business) {
        res.status(403).json({ success: false, error: { code: "NO_BUSINESS", message: "No business found for this user" } });
        return;
      }

      const count = await MessageService.getUnreadCount(business.id);
      res.status(200).json({ success: true, data: { count } });
    } catch (error) {
      next(error);
    }
  }
}
