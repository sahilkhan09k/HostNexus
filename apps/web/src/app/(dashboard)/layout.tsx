import type { Metadata } from "next";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/top-bar";

export const metadata: Metadata = {
  title: "Dashboard - HostNexus",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAF9]">
      <DashboardSidebar />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overscroll-contain p-6 scroll-smooth">
          {children}
        </main>
      </div>
    </div>
  );
}
