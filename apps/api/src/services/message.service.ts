import { prisma } from "../config/database.js";

export class MessageService {
  /**
   * Get or create a conversation between two businesses.
   * IDs are sorted so (A,B) and (B,A) resolve to the same conversation.
   */
  static async getOrCreateConversation(businessAId: string, businessBId: string) {
    const [first, second] = [businessAId, businessBId].sort();

    let conversation = await prisma.conversation.findUnique({
      where: { businessAId_businessBId: { businessAId: first, businessBId: second } },
      include: {
        businessA: { select: { id: true, name: true } },
        businessB: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { id: true, name: true } } },
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { businessAId: first, businessBId: second },
        include: {
          businessA: { select: { id: true, name: true } },
          businessB: { select: { id: true, name: true } },
          messages: {
            orderBy: { createdAt: "asc" },
            include: { sender: { select: { id: true, name: true } } },
          },
        },
      });
    }

    return conversation;
  }

  /**
   * Get all conversations for a business, sorted by most recently updated.
   * Includes only the last message for preview purposes.
   */
  static async getConversations(businessId: string) {
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ businessAId: businessId }, { businessBId: businessId }],
      },
      include: {
        businessA: { select: { id: true, name: true } },
        businessB: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { sender: { select: { id: true, name: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return conversations;
  }

  /**
   * Get all messages in a conversation.
   * Verifies the requesting business is a participant.
   * Marks incoming unread messages as read.
   */
  static async getMessages(conversationId: string, businessId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ businessAId: businessId }, { businessBId: businessId }],
      },
    });

    if (!conversation) throw new Error("Conversation not found");

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: { id: true, name: true } } },
    });

    // Mark incoming unread messages as read
    await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: businessId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return messages;
  }

  /**
   * Send a message in a conversation.
   * Verifies the sender is a participant.
   * Bumps conversation updatedAt for sorting.
   */
  static async sendMessage(conversationId: string, senderId: string, content: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ businessAId: senderId }, { businessBId: senderId }],
      },
    });

    if (!conversation) throw new Error("Conversation not found");

    const message = await prisma.message.create({
      data: { conversationId, senderId, content },
      include: { sender: { select: { id: true, name: true } } },
    });

    // Bump conversation so it surfaces at the top of the list
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  /**
   * Count unread messages across all conversations for a business.
   */
  static async getUnreadCount(businessId: string) {
    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ businessAId: businessId }, { businessBId: businessId }] },
      select: { id: true },
    });

    const count = await prisma.message.count({
      where: {
        conversationId: { in: conversations.map((c) => c.id) },
        senderId: { not: businessId },
        readAt: null,
      },
    });

    return count;
  }
}
