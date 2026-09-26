"use client";

import { AiConciergeChat } from "@/components/ai/ai-concierge-chat";

export default function DashboardAiConciergePage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs">
      <AiConciergeChat title="Concierge Copilot" />
    </div>
  );
}
