"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, type Easing } from "framer-motion";
import {
  Send, Sparkles, User, MapPin, Star,
  Users, ArrowUpRight, RotateCcw, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EASE: Easing = [0.22, 1, 0.36, 1];

/* ── Types ── */
interface TextMessage {
  id: string;
  role: "user" | "assistant";
  type: "text";
  content: string;
  timestamp: Date;
}

interface ResourceResult {
  id: string;
  title: string;
  business: string;
  location: string;
  price: string;
  capacity: string;
  rating: number;
  match: number;
  available: boolean;
  category: string;
  categoryColor: string;
  bg: string;
}

interface ResultsMessage {
  id: string;
  role: "assistant";
  type: "results";
  content: string;
  results: ResourceResult[];
  timestamp: Date;
}

type Message = TextMessage | ResultsMessage;

/* ── Suggested prompts ── */
const SUGGESTIONS = [
  "I need a banquet hall for 300 people in Koregaon Park this Saturday",
  "Find a commercial kitchen near Viman Nagar for weekend catering",
  "Rent AV equipment for a 200-person conference under ₹15,000",
  "Show me event spaces available next week in Pune under ₹30,000",
  "I need luxury chairs and tables for 150 pax tomorrow",
];

/* ── Mock AI response generator ── */
const MOCK_RESULTS: ResourceResult[] = [
  {
    id: "1",
    title: "Grand Ballroom",
    business: "JW Marriott Pune",
    location: "Koregaon Park",
    price: "₹45,000/day",
    capacity: "500 pax",
    rating: 4.9,
    match: 96,
    available: true,
    category: "Banquet Hall",
    categoryColor: "bg-violet-100 text-violet-700",
    bg: "bg-gradient-to-br from-violet-50 to-indigo-50",
  },
  {
    id: "7",
    title: "Crystal Banquet Hall",
    business: "The Westin Pune",
    location: "Koregaon Park",
    price: "₹35,000/day",
    capacity: "400 pax",
    rating: 4.8,
    match: 91,
    available: true,
    category: "Banquet Hall",
    categoryColor: "bg-violet-100 text-violet-700",
    bg: "bg-gradient-to-br from-purple-50 to-violet-50",
  },
  {
    id: "4",
    title: "Rooftop Terrace",
    business: "Hyatt Regency Pune",
    location: "Nagar Road",
    price: "₹28,000/day",
    capacity: "350 pax",
    rating: 4.9,
    match: 84,
    available: true,
    category: "Event Space",
    categoryColor: "bg-rose-100 text-rose-700",
    bg: "bg-gradient-to-br from-rose-50 to-pink-50",
  },
];

async function* streamMockResponse(text: string): AsyncGenerator<string> {
  for (const char of text) {
    yield char;
    await new Promise((r) => setTimeout(r, 14 + Math.random() * 8));
  }
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-stone-400"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function ResourceResultCard({ result, index }: { result: ResourceResult; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.08, ease: EASE }}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-stone-200 bg-white",
        "shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-md"
      )}
    >
      <div className={cn("h-1.5 w-full", result.bg.replace("bg-gradient-to-br", "bg-gradient-to-r"))} />
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", result.categoryColor)}>
              {result.category}
            </span>
            <p className="mt-1 text-sm font-bold text-stone-900 truncate">{result.title}</p>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-stone-400">
              <MapPin className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
              {result.business} · {result.location}
            </div>
          </div>
          {/* Match score */}
          <div className="shrink-0 text-right">
            <div className="text-xs font-black text-emerald-600">{result.match}%</div>
            <div className="text-[9px] text-stone-400">match</div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-stone-400">
            <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{result.capacity}</span>
            <span className="flex items-center gap-0.5">
              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-stone-600">{result.rating}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-800">{result.price}</span>
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              Book <ArrowUpRight className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AiConciergeDashboardPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      type: "text",
      content: "Hi! I'm your HostNexus AI Concierge. Tell me what hospitality resource you need — banquet halls, commercial kitchens, AV equipment, furniture, vehicles — and I'll find the best matches instantly.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: TextMessage = {
      id: Date.now().toString(),
      role: "user",
      type: "text",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsStreaming(true);
    setStreamingText("");

    // Simulate streaming text response
    const responseText = `I found several great options matching your request. Let me analyse availability, capacity, and pricing across our verified network in Pune and Mumbai...`;
    let streamed = "";
    for await (const char of streamMockResponse(responseText)) {
      streamed += char;
      setStreamingText(streamed);
    }

    // Add text message
    const textMsg: TextMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      type: "text",
      content: responseText,
      timestamp: new Date(),
    };

    // Add results message
    const resultsMsg: ResultsMessage = {
      id: (Date.now() + 2).toString(),
      role: "assistant",
      type: "results",
      content: "Here are the top 3 matches based on your requirements:",
      results: MOCK_RESULTS,
      timestamp: new Date(),
    };

    setMessages((m) => [...m, textMsg, resultsMsg]);
    setStreamingText("");
    setIsStreaming(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome-new",
        role: "assistant",
        type: "text",
        content: "Chat cleared! How can I help you find hospitality resources today?",
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Left Sidebar ── */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-stone-200 bg-white lg:flex">
        <div className="border-b border-stone-100 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 shadow-sm">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-900">AI Concierge</p>
              <p className="text-xs text-stone-400">Powered by Gemini + RAG</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-stone-400">Try asking</p>
          <div className="space-y-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => sendMessage(s)}
                disabled={isStreaming}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-left text-xs text-stone-600 transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-stone-100 p-4">
          <button
            type="button"
            onClick={clearChat}
            className="flex w-full items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-500 transition-all hover:border-stone-300 hover:bg-stone-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New conversation
          </button>
        </div>
      </aside>

      {/* ── Chat area ── */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[#FAFAF9]">
        {/* Chat header */}
        <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
              <Sparkles className="h-4 w-4 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900">HostNexus AI</p>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-stone-400">Online · Pune &amp; Mumbai</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={clearChat}
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-50 lg:hidden"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8">
          <div className="mx-auto max-w-3xl space-y-5">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
                >
                  {/* Avatar */}
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    msg.role === "assistant"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-stone-800 text-white"
                  )}>
                    {msg.role === "assistant"
                      ? <Sparkles className="h-3.5 w-3.5" />
                      : <User className="h-3.5 w-3.5" />}
                  </div>

                  {/* Bubble */}
                  <div className={cn("max-w-[75%]", msg.role === "user" && "flex flex-col items-end")}>
                    {msg.type === "text" && (
                      <div className={cn(
                        "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                        msg.role === "assistant"
                          ? "rounded-tl-sm bg-white border border-stone-200 text-stone-700 shadow-sm"
                          : "rounded-tr-sm bg-emerald-600 text-white"
                      )}>
                        {msg.content}
                      </div>
                    )}

                    {msg.type === "results" && (
                      <div className="w-full max-w-lg">
                        <p className="mb-3 text-sm font-semibold text-stone-700">{msg.content}</p>
                        <div className="space-y-2">
                          {msg.results.map((r, i) => (
                            <ResourceResultCard key={r.id} result={r} index={i} />
                          ))}
                        </div>
                        <button
                          type="button"
                          className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-100"
                        >
                          View all results in Marketplace →
                        </button>
                      </div>
                    )}

                    <p className="mt-1 text-[10px] text-stone-400 px-1">
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Streaming indicator */}
            {isStreaming && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-stone-200 bg-white px-4 py-3 shadow-sm">
                  {streamingText ? (
                    <p className="text-sm leading-relaxed text-stone-700">{streamingText}<span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-emerald-500" /></p>
                  ) : (
                    <TypingDots />
                  )}
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-stone-200 bg-white px-4 py-4 md:px-8">
          <div className="mx-auto max-w-3xl">
            {/* Mobile suggestions */}
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide lg:hidden">
              {SUGGESTIONS.slice(0, 3).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  disabled={isStreaming}
                  className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
                >
                  {s.slice(0, 40)}…
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex items-end gap-3">
              <div className="flex-1 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
                  }}
                  placeholder="Describe what you need — I'll find the best matches..."
                  rows={1}
                  disabled={isStreaming}
                  className="w-full resize-none bg-transparent text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none disabled:opacity-60"
                  style={{ maxHeight: "120px" }}
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all",
                  input.trim() && !isStreaming
                    ? "bg-emerald-600 text-white shadow-[0_2px_8px_rgba(5,150,105,0.30)] hover:bg-emerald-700 active:scale-95"
                    : "bg-stone-100 text-stone-400 cursor-not-allowed"
                )}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-2 text-center text-[10px] text-stone-400">
              AI responses are based on live platform data · Always verify availability before booking
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
