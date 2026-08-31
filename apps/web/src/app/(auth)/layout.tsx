import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";

export const metadata: Metadata = {
  title: "HostNexus — Account",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF9]">
      {/* Minimal auth navbar */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-5 md:px-10">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
              <Building2 className="h-4 w-4 text-white" strokeWidth={2.2} />
            </div>
            <span className="font-display text-[17px] font-bold tracking-tight text-stone-900">
              Host<span className="text-emerald-600">Nexus</span>
            </span>
          </Link>
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
            Back to home
          </Link>
        </div>
      </header>

      {/* Page content */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </main>

      <footer className="border-t border-stone-100 py-4 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} HostNexus Technologies Pvt. Ltd. ·{" "}
        <Link href="#" className="hover:text-emerald-600 transition-colors">Privacy Policy</Link>
        {" · "}
        <Link href="#" className="hover:text-emerald-600 transition-colors">Terms of Service</Link>
      </footer>
    </div>
  );
}
