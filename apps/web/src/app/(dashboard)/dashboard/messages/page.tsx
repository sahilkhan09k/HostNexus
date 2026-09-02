"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Send, MoreVertical, MessageSquare, PenSquare, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { AuthService } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BusinessSnippet {
  id: string;
  name: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender: BusinessSnippet;
  content: string;
  readAt: string | null;
  createdAt: string;
}

interface Conversation {
  id: string;
  businessAId: string;
  businessBId: string;
  businessA: BusinessSnippet;
  businessB: BusinessSnippet;
  messages: Message[]; // last 1 for list preview
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOtherBusiness(conv: Conversation, myId: string): BusinessSnippet {
  return conv.businessAId === myId ? conv.businessB : conv.businessA;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getUnreadCount(conv: Conversation, myId: string): number {
  // The list endpoint only includes the last message; unread badge is approximated.
  // Real unread counts come from the /unread endpoint; here we check the last message.
  const last = conv.messages[0];
  if (!last) return 0;
  return last.senderId !== myId && last.readAt === null ? 1 : 0;
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { business } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewMsgModal, setShowNewMsgModal] = useState(false);
  const [newMsgSearch, setNewMsgSearch] = useState("");
  const [availableBusinesses, setAvailableBusinesses] = useState<BusinessSnippet[]>([]);
  const [startingConv, setStartingConv] = useState<string | null>(null); // businessId being connected
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch conversation list ──────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    const token = AuthService.getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.data.conversations ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ── Fetch messages for selected conversation ─────────────────────────────

  const fetchMessages = useCallback(async (conversationId: string) => {
    const token = AuthService.getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.data.messages ?? []);
    } catch {
      // silently fail
    }
  }, []);

  // ── Polling when a conversation is open ─────────────────────────────────

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selectedId) return;

    pollRef.current = setInterval(() => {
      fetchMessages(selectedId);
      fetchConversations();
    }, 10_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedId, fetchMessages, fetchConversations]);

  // ── Select conversation ──────────────────────────────────────────────────

  const selectConversation = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setMessages([]);
      await fetchMessages(id);
    },
    [fetchMessages]
  );

  // ── Auto-scroll to bottom ────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ─────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!input.trim() || !selectedId || sending) return;
    const token = AuthService.getToken();
    if (!token) return;

    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: selectedId,
      senderId: business?.id ?? "",
      sender: { id: business?.id ?? "", name: business?.name ?? "" },
      content: input.trim(),
      readAt: null,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    const sentContent = input.trim();
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/messages/${selectedId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: sentContent }),
      });
      if (res.ok) {
        const data = await res.json();
        // Replace optimistic message with real one
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMsg.id ? data.data.message : m))
        );
        // Refresh conversation list to update last-message preview
        fetchConversations();
      }
    } catch {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setInput(sentContent);
    } finally {
      setSending(false);
    }
  };

  // ── Fetch available businesses for new message modal ────────────────────

  useEffect(() => {
    if (!showNewMsgModal) return;
    const fetchBusinesses = async () => {
      const token = AuthService.getToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/resources/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const resources: { business: BusinessSnippet }[] = data?.data?.resources ?? [];
        // Extract unique businesses, exclude own business
        const seen = new Set<string>();
        const businesses: BusinessSnippet[] = [];
        for (const r of resources) {
          if (r.business?.id && !seen.has(r.business.id) && r.business.id !== business?.id) {
            seen.add(r.business.id);
            businesses.push(r.business);
          }
        }
        setAvailableBusinesses(businesses);
      } catch { /* silently fail */ }
    };
    fetchBusinesses();
  }, [showNewMsgModal, business?.id]);

  // ── Start conversation ───────────────────────────────────────────────────

  const startConversation = async (otherBusinessId: string) => {
    const token = AuthService.getToken();
    if (!token) return;
    setStartingConv(otherBusinessId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/messages/conversations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ otherBusinessId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const conv = data.data.conversation;
      setShowNewMsgModal(false);
      setNewMsgSearch("");
      await fetchConversations();
      await selectConversation(conv.id);
    } catch { /* silently fail */ }
    finally { setStartingConv(null); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Derived state ────────────────────────────────────────────────────────

  const myId = business?.id ?? "";
  const filteredConversations = conversations.filter((conv) => {
    const other = getOtherBusiness(conv, myId);
    return other.name.toLowerCase().includes(search.toLowerCase());
  });
  const selectedConv = conversations.find((c) => c.id === selectedId);
  const otherBusiness = selectedConv ? getOtherBusiness(selectedConv, myId) : null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-stone-900">Messages</h1>
        <p className="mt-1 text-sm text-stone-500">Chat with businesses you&apos;ve connected with</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* ── Conversation list ── */}
        <div className="rounded-2xl border border-stone-200 bg-white shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
          <div className="border-b border-stone-100 p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="search"
                  placeholder="Search conversations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-sm placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowNewMsgModal(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                aria-label="New conversation"
              >
                <PenSquare className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {loading ? (
              /* Skeleton */
              <div className="space-y-px p-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl p-3">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-stone-100" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3 w-32 animate-pulse rounded bg-stone-100" />
                      <div className="h-2.5 w-48 animate-pulse rounded bg-stone-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
                  <MessageSquare className="h-5 w-5 text-stone-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-700">No conversations yet</p>
                  <p className="mt-1 text-xs text-stone-400">
                    Start chatting with businesses you&apos;ve booked with.
                  </p>
                </div>
              </div>
            ) : (
              filteredConversations.map((conv, i) => {
                const other = getOtherBusiness(conv, myId);
                const lastMsg = conv.messages[0];
                const unread = getUnreadCount(conv, myId);
                return (
                  <motion.button
                    key={conv.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.04 }}
                    onClick={() => selectConversation(conv.id)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-stone-100 p-4 text-left transition-colors last:border-b-0",
                      selectedId === conv.id ? "bg-emerald-50" : "hover:bg-stone-50"
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                      {other.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-stone-900">{other.name}</p>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {lastMsg && (
                            <span className="text-[10px] text-stone-400">
                              {formatTime(lastMsg.createdAt)}
                            </span>
                          )}
                          {unread > 0 && (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">
                              {unread}
                            </span>
                          )}
                        </div>
                      </div>
                      {lastMsg ? (
                        <p className="mt-0.5 truncate text-xs text-stone-500">
                          {lastMsg.senderId === myId ? "You: " : ""}
                          {lastMsg.content}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs italic text-stone-400">No messages yet</p>
                      )}
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Chat area ── */}
        <div className="rounded-2xl border border-stone-200 bg-white shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
          {!selectedConv ? (
            /* Empty state */
            <div className="flex h-[600px] flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
                <MessageSquare className="h-6 w-6 text-stone-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-700">Select a conversation</p>
                <p className="mt-1 text-xs text-stone-400">
                  Choose a conversation from the list to start messaging.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-100 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                    {otherBusiness?.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-900">{otherBusiness?.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                  aria-label="More options"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex h-[500px] flex-col">
                <div className="flex-1 overflow-y-auto p-4">
                  <AnimatePresence initial={false}>
                    {messages.length === 0 ? (
                      <div className="flex h-full items-center justify-center">
                        <p className="text-xs text-stone-400">No messages yet. Say hello!</p>
                      </div>
                    ) : (
                      <MessageList messages={messages} myId={myId} />
                    )}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-stone-100 p-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      disabled={sending}
                    />
                    <button
                      type="button"
                      onClick={sendMessage}
                      disabled={!input.trim() || sending}
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                        input.trim() && !sending
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-stone-100 text-stone-400 cursor-not-allowed"
                      )}
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Message Modal */}
      <AnimatePresence>
        {showNewMsgModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={() => { setShowNewMsgModal(false); setNewMsgSearch(""); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-white border border-stone-200 rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold text-stone-900">New Conversation</h2>
                <button
                  type="button"
                  onClick={() => { setShowNewMsgModal(false); setNewMsgSearch(""); }}
                  className="rounded-lg p-1 text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="search"
                  placeholder="Search businesses..."
                  value={newMsgSearch}
                  onChange={(e) => setNewMsgSearch(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-9 pr-3 text-sm placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  autoFocus
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {availableBusinesses.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <Users className="h-8 w-8 text-stone-300 mb-2" />
                    <p className="text-sm text-stone-500">No businesses found</p>
                    <p className="text-xs text-stone-400 mt-1">Browse the marketplace to discover businesses</p>
                  </div>
                ) : (
                  availableBusinesses
                    .filter(b => b.name.toLowerCase().includes(newMsgSearch.toLowerCase()))
                    .map((biz) => (
                      <button
                        key={biz.id}
                        type="button"
                        onClick={() => startConversation(biz.id)}
                        disabled={startingConv === biz.id}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-stone-50 transition-colors disabled:opacity-60"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                          {biz.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-stone-800">{biz.name}</span>
                        {startingConv === biz.id && (
                          <span className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                        )}
                      </button>
                    ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Message list with sender-run grouping ────────────────────────────────────

function MessageList({ messages, myId }: { messages: Message[]; myId: string }) {
  return (
    <div className="space-y-1">
      {messages.map((msg, i) => {
        const isMe = msg.senderId === myId;
        const prevMsg = messages[i - 1];
        const isFirstInRun = !prevMsg || prevMsg.senderId !== msg.senderId;

        return (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "flex",
              isMe ? "justify-end" : "justify-start",
              isFirstInRun ? "mt-4" : "mt-0.5"
            )}
          >
            <div className={cn("max-w-[70%]", isMe ? "items-end" : "items-start", "flex flex-col")}>
              {isFirstInRun && !isMe && (
                <span className="mb-1 ml-1 text-[10px] font-medium text-stone-500">
                  {msg.sender.name}
                </span>
              )}
              <div
                className={cn(
                  "inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  isMe
                    ? "rounded-br-sm bg-emerald-600 text-white"
                    : "rounded-bl-sm bg-stone-100 text-stone-900"
                )}
              >
                {msg.content}
              </div>
              <p className={cn("mt-0.5 text-[10px] text-stone-400", isMe ? "text-right" : "text-left")}>
                {formatTime(msg.createdAt)}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
