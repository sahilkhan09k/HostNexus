"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Send, Paperclip, MoreVertical, Phone, Video } from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_CONVERSATIONS = [
  { id: "1", name: "Radisson Blu Pune", lastMessage: "Thanks for confirming the booking!", time: "2 min ago", unread: 2, online: true },
  { id: "2", name: "Hyatt Regency", lastMessage: "Can we extend the booking by 2 hours?", time: "1 hour ago", unread: 1, online: true },
  { id: "3", name: "Fortune Hotels", lastMessage: "The equipment is perfect for our needs", time: "3 hours ago", unread: 0, online: false },
  { id: "4", name: "The Westin Pune", lastMessage: "We need AV support for the event", time: "Yesterday", unread: 3, online: false },
  { id: "5", name: "ITC Maratha Mumbai", lastMessage: "Payment has been processed", time: "2 days ago", unread: 0, online: false },
];

const MOCK_MESSAGES = [
  { id: "1", sender: "them", text: "Hi! Is the Grand Ballroom available on Sept 2?", time: "10:30 AM" },
  { id: "2", sender: "me", text: "Yes, it's available! Would you like to proceed with the booking?", time: "10:32 AM" },
  { id: "3", sender: "them", text: "Great! What's included in the package?", time: "10:33 AM" },
  { id: "4", sender: "me", text: "The package includes 500-person capacity, basic AV setup, tables and chairs, and 8-hour access.", time: "10:35 AM" },
  { id: "5", sender: "them", text: "Perfect! Let's book it. Can we get catering as well?", time: "10:37 AM" },
  { id: "6", sender: "me", text: "Absolutely! I can connect you with our catering partner. The booking is confirmed for Sept 2, 10 AM - 6 PM.", time: "10:40 AM" },
  { id: "7", sender: "them", text: "Thanks for confirming the booking!", time: "10:42 AM" },
];

export default function MessagesPage() {
  const [selectedChat, setSelectedChat] = useState("1");
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-stone-900">Messages</h1>
        <p className="mt-1 text-sm text-stone-500">Chat with clients and manage conversations</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-stone-200 bg-white shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
          <div className="border-b border-stone-100 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                placeholder="Search conversations..."
                className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-sm placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {MOCK_CONVERSATIONS.map((conv, i) => (
              <motion.button
                key={conv.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                onClick={() => setSelectedChat(conv.id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-stone-100 p-4 text-left transition-colors",
                  selectedChat === conv.id ? "bg-emerald-50" : "hover:bg-stone-50"
                )}
              >
                <div className="relative shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                    {conv.name.charAt(0)}
                  </div>
                  {conv.online && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-stone-900">{conv.name}</p>
                    {conv.unread > 0 && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-stone-500">{conv.lastMessage}</p>
                  <p className="mt-1 text-[10px] text-stone-400">{conv.time}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between border-b border-stone-100 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                R
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-900">Radisson Blu Pune</p>
                <p className="text-xs text-emerald-600">Online</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600">
                <Phone className="h-4 w-4" />
              </button>
              <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600">
                <Video className="h-4 w-4" />
              </button>
              <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex h-[500px] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {MOCK_MESSAGES.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className={cn("flex", msg.sender === "me" ? "justify-end" : "justify-start")}
                >
                  <div className={cn("max-w-[70%]", msg.sender === "me" ? "text-right" : "text-left")}>
                    <div
                      className={cn(
                        "inline-block rounded-2xl px-4 py-2.5 text-sm",
                        msg.sender === "me"
                          ? "bg-emerald-600 text-white"
                          : "bg-stone-100 text-stone-900"
                      )}
                    >
                      {msg.text}
                    </div>
                    <p className="mt-1 text-[10px] text-stone-400">{msg.time}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="border-t border-stone-100 p-4">
              <div className="flex items-center gap-2">
                <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600">
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}