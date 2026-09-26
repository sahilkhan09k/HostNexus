"use client";

import { Navbar } from "@/components/layout/navbar";
import { AiConciergeChat } from "@/components/ai/ai-concierge-chat";

export default function AiConciergePage() {
  return (
    <div className="flex h-screen flex-col bg-stone-50 overflow-hidden">
      <Navbar />
      <div className="flex-1 overflow-hidden pt-16">
        <AiConciergeChat title="HostNexus AI Concierge" />
      </div>
    </div>
  );
}
