"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence, type Easing } from "framer-motion";
import {
  Send, Sparkles, User, MapPin, Star,
  Users, ArrowUpRight, RotateCcw,
  ShieldCheck, HelpCircle, AlertTriangle, Layers,
  ChevronRight, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { queryAiConcierge, type AiListingResult } from "@/lib/api-client";

const EASE: Easing = [0.22, 1, 0.36, 1];

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  results?: AiListingResult[];
  sources?: string[];
  suggestedFollowUps?: string[];
  intent?: string;
  timestamp: Date;
}

const DEFAULT_SUGGESTIONS = [
  {
    category: "Multi-Item Order",
    text: "I want to order 30 chairs, 40 tables on 28th October",
    badge: "Inventory Search",
  },
  {
    category: "Damage & Protection",
    text: "What will happen if my product gets damage?",
    badge: "Policy FAQ",
  },
  {
    category: "Financial Escrow",
    text: "How does the escrow payment and security deposit refund work?",
    badge: "Escrow Rules",
  },
  {
    category: "B2B Bargaining",
    text: "Can I negotiate the price or get a bulk discount?",
    badge: "Negotiation",
  },
  {
    category: "Venue Search",
    text: "Find a banquet hall for 300 guests in Pune under ₹50,000",
    badge: "Marketplace",
  },
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-2 w-2 rounded-full bg-emerald-500/70"
          animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
      <span className="ml-2 text-xs font-medium text-stone-400">Searching live inventory & policies...</span>
    </div>
  );
}

/**
 * Format markdown-like text with headers, bullet points, bold tags, and links
 */
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-2 text-sm leading-relaxed text-stone-700">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Heading 3
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={idx} className="pt-2 text-base font-bold text-stone-900 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {parseInlineMarkdown(trimmed.replace("### ", ""))}
            </h3>
          );
        }

        // Heading 4
        if (trimmed.startsWith("#### ")) {
          return (
            <h4 key={idx} className="pt-1 text-sm font-semibold text-stone-900">
              {parseInlineMarkdown(trimmed.replace("#### ", ""))}
            </h4>
          );
        }

        // Blockquote / Callout
        if (trimmed.startsWith("> ")) {
          return (
            <div
              key={idx}
              className="my-2 rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3 text-xs font-medium text-emerald-900 shadow-sm"
            >
              {parseInlineMarkdown(trimmed.replace("> ", ""))}
            </div>
          );
        }

        // Unordered list
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
          const itemText = trimmed.replace(/^(\*|-)\s+/, "");
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <div className="flex-1">{parseInlineMarkdown(itemText)}</div>
            </div>
          );
        }

        // Regular paragraph
        return <p key={idx}>{parseInlineMarkdown(trimmed)}</p>;
      })}
    </div>
  );
}

/**
 * Parses bold **text** and [link text](url) within a line
 */
function parseInlineMarkdown(text: string) {
  // Regex matches [label](url) or **bold**
  const regex = /(\[.*?\]\(.*?\)|\*\*.*?\*\*)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-stone-900">
          {part.slice(2, -2)}
        </strong>
      );
    }

    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      return (
        <Link
          key={index}
          href={url}
          className="inline-flex items-center gap-0.5 font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-800"
        >
          {label}
          <ExternalLink className="h-3 w-3 inline" />
        </Link>
      );
    }

    return part;
  });
}

function ResourceResultCard({ result, index }: { result: AiListingResult; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.08, ease: EASE }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white",
        "shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1 hover:shadow-lg hover:border-emerald-200"
      )}
    >
      <div className={cn("h-1.5 w-full", result.bg.replace("bg-gradient-to-br", "bg-gradient-to-r"))} />
      <div className="p-4">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", result.categoryColor)}>
                {result.category}
              </span>
              {result.hasPreExistingDamage && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                  <AlertTriangle className="h-2.5 w-2.5" /> Condition Stamped
                </span>
              )}
            </div>
            <Link
              href={`/marketplace/${result.id}`}
              className="mt-1.5 block text-base font-bold text-stone-900 group-hover:text-emerald-700 transition-colors truncate"
            >
              {result.title}
            </Link>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">
              <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
              <span>{result.business} · {result.location}</span>
            </div>
          </div>

          {/* Match Score Badge */}
          <div className="shrink-0 text-right rounded-xl bg-emerald-50 px-2.5 py-1.5 border border-emerald-100">
            <div className="text-sm font-black text-emerald-700">{result.match}%</div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-600">match</div>
          </div>
        </div>

        {/* Why choose this callout */}
        {result.whyChoose && (
          <div className="mt-3 rounded-xl bg-stone-50 p-2.5 text-xs text-stone-600 border border-stone-100 flex items-start gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="leading-snug">{result.whyChoose}</p>
          </div>
        )}

        {/* Features badges */}
        {result.features && result.features.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {result.features.map((feat, fIdx) => (
              <span key={fIdx} className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                {feat}
              </span>
            ))}
          </div>
        )}

        {/* Bottom stats and Book button */}
        <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
          <div className="flex items-center gap-3 text-xs text-stone-500">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 text-stone-400" />
              {result.capacity}
            </span>
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-stone-700">{result.rating}</span>
              <span className="text-[10px] text-stone-400">({result.reviewCount})</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-bold text-stone-900">{result.price}</div>
              <div className="text-[10px] text-stone-400">Deposit: {result.securityDeposit}</div>
            </div>
            <Link
              href={`/marketplace/${result.id}`}
              className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-all hover:shadow"
            >
              Book <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function AiConciergeChat({ title = "HostNexus AI Concierge" }: { title?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        `### 👋 Welcome to HostNexus AI Concierge\n` +
        `I am your intelligent hospitality assistant backed by the full **HostNexus RAG pipeline**.\n\n` +
        `You can ask me to:\n` +
        `* **Find & Order Inventory**: *e.g., "I want to order 30 chairs, 40 tables on 28th October"*\n` +
        `* **Explain Rules & Damage Protocol**: *e.g., "What will happen if my product gets damage?"*\n` +
        `* **Financial Security**: *e.g., "How does escrow payment and deposit refund work?"*\n` +
        `* **B2B Bulk Negotiation**: *e.g., "Can I negotiate price with equipment owners?"*`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Build conversation history for context
      const history = messages.slice(-6).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Call the real Express RAG backend
      const response = await queryAiConcierge({
        message: trimmed,
        history,
      });

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.reply,
        results: response.results,
        sources: response.sources,
        suggestedFollowUps: response.suggestedFollowUps,
        intent: response.intent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("AI Concierge request failed:", err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          `### ⚠️ Connection Notice\n` +
          `I couldn't reach the backend AI pipeline at this moment (${err?.message || "Network Error"}).\n` +
          `Please verify that the API server is running on \`http://localhost:5000\`.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          `### 🔄 Chat Reset\n` +
          `Ask me anything about marketplace listings, multi-item orders (chairs, tables, halls), damage policies, or escrow protections.`,
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-stone-50">
      {/* ── Left Sidebar (Desktop) ── */}
      <aside className="hidden w-80 shrink-0 flex-col border-r border-stone-200 bg-white lg:flex">
        {/* Header */}
        <div className="border-b border-stone-200 p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-sm shadow-emerald-500/20 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900">{title}</h2>
              <p className="text-[11px] text-stone-400">Live RAG Inventory &amp; Policies</p>
            </div>
          </div>
        </div>

        {/* Quick Capabilities */}
        <div className="p-4 border-b border-stone-100 bg-stone-50/50">
          <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">Connected Knowledge</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-stone-600 font-medium">
              <Layers className="h-3.5 w-3.5 text-emerald-600" /> Live Database Listings
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-600 font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Damage &amp; Escrow Rules
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-600 font-medium">
              <HelpCircle className="h-3.5 w-3.5 text-emerald-600" /> 4-Stage Chain of Custody
            </div>
          </div>
        </div>

        {/* Suggested Prompts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 px-1">Try Asking:</p>
          {DEFAULT_SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => sendMessage(s.text)}
              disabled={isLoading}
              className="w-full text-left rounded-xl border border-stone-200/90 bg-white p-3 shadow-xs hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-sm transition-all group disabled:opacity-50"
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-emerald-700 mb-1">
                <span>{s.category}</span>
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] border border-emerald-100">{s.badge}</span>
              </div>
              <p className="text-xs text-stone-700 line-clamp-2 group-hover:text-stone-900">{s.text}</p>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-stone-200 p-4">
          <button
            type="button"
            onClick={clearChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 hover:border-stone-300 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Start New Conversation
          </button>
        </div>
      </aside>

      {/* ── Chat Main Area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-900">HostNexus AI Concierge</p>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-medium text-emerald-700">RAG Pipeline Active · Real-time Inventory &amp; Policies</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={clearChat}
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-50 lg:hidden"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>

        {/* Messages Scroll View */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto max-w-3xl space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className={cn("flex gap-3.5", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-xs",
                      msg.role === "assistant"
                        ? "bg-gradient-to-br from-emerald-500 to-teal-700 text-white"
                        : "bg-stone-800 text-white"
                    )}
                  >
                    {msg.role === "assistant" ? <Sparkles className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>

                  {/* Message Bubble Container */}
                  <div className={cn("max-w-[85%]", msg.role === "user" && "flex flex-col items-end")}>
                    {/* Text Box */}
                    <div
                      className={cn(
                        "rounded-2xl p-4 shadow-sm",
                        msg.role === "assistant"
                          ? "rounded-tl-sm border border-stone-200/90 bg-white"
                          : "rounded-tr-sm bg-emerald-700 text-white font-medium"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <MarkdownRenderer content={msg.content} />
                      ) : (
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      )}
                    </div>

                    {/* Matched Listings (if present) */}
                    {msg.results && msg.results.length > 0 && (
                      <div className="mt-4 w-full space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                            Available Inventory ({msg.results.length} Matches Found)
                          </p>
                          <Link
                            href="/marketplace"
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                          >
                            Explore Marketplace <ChevronRight className="h-3 w-3" />
                          </Link>
                        </div>
                        <div className="space-y-3">
                          {msg.results.map((r, i) => (
                            <ResourceResultCard key={r.id} result={r} index={i} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Policy Sources Cited */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 px-1">
                        <span className="text-[10px] font-semibold text-stone-400 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3 text-emerald-600" /> Verified Sources:
                        </span>
                        {msg.sources.slice(0, 3).map((src, sIdx) => (
                          <span
                            key={sIdx}
                            className="rounded-full bg-stone-100 border border-stone-200 px-2 py-0.5 text-[10px] text-stone-600"
                          >
                            {src}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Follow-up suggestions */}
                    {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 px-1">
                        {msg.suggestedFollowUps.map((prompt, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => sendMessage(prompt)}
                            disabled={isLoading}
                            className="rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-1 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 hover:border-emerald-300 disabled:opacity-50"
                          >
                            💡 {prompt}
                          </button>
                        ))}
                      </div>
                    )}

                    <p className="mt-1.5 px-1 text-[10px] text-stone-400">
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading state indicator */}
            {isLoading && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-xs">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-stone-200 bg-white p-3 shadow-xs">
                  <TypingDots />
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input Bar */}
        <div className="border-t border-stone-200 bg-white p-4 md:px-8">
          <div className="mx-auto max-w-3xl">
            {/* Quick mobile pills */}
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide lg:hidden">
              {DEFAULT_SUGGESTIONS.slice(0, 3).map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendMessage(s.text)}
                  disabled={isLoading}
                  className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs text-stone-700 hover:bg-emerald-50 hover:border-emerald-200 disabled:opacity-50"
                >
                  {s.category}: {s.text.slice(0, 35)}...
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="flex items-center gap-3"
            >
              <div className="flex flex-1 items-center rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2.5 transition-all focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/20">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about listings ('30 chairs, 40 tables') or policies ('what if product gets damaged?')..."
                  disabled={isLoading}
                  className="w-full bg-transparent text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none disabled:opacity-60"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm transition-all hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-2 text-center text-[10px] text-stone-400">
              HostNexus RAG Concierge searches real database listings and verified platform policies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
