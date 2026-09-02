import { Router, type IRouter } from "express";
import { MessageController } from "../controllers/message.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router: IRouter = Router();

// All message routes require authentication
router.use(authenticate);

// Must be before /:conversationId to avoid route collision
router.get("/unread", MessageController.getUnreadCount);
router.get("/conversations", MessageController.getConversations);
router.post("/conversations", MessageController.startConversation);

// Conversation list and creation
router.get("/", MessageController.getConversations);

// Per-conversation
router.get("/:conversationId", MessageController.getMessages);
router.post("/:conversationId", MessageController.sendMessage);

export default router;

