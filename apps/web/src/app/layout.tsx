import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/components/ds/ds.css";
import { AuthProvider } from "@/contexts/auth-context";
import { LenisProvider } from "@/components/effects/lenis-provider";

// HostNexus design system typeface (substitute for the source neo-grotesk)
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HostNexus — B2B Marketplace for Hospitality Resource Sharing",
  description:
    "AI-powered B2B marketplace connecting hotels, caterers, banquet halls and event organizers to discover, share and coordinate idle resources.",
  keywords: ["hospitality", "B2B marketplace", "resource sharing", "hotel", "banquet hall", "catering", "Pune", "Mumbai"],
};

interface LayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${geistMono.variable} h-full`}
      // Browser extensions (dark mode, Grammarly, ...) add classes/attributes to
      // <html> before hydration; only this element's attributes are exempt.
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[#FAFAFA] text-[#131519] antialiased">
        <AuthProvider>
          <LenisProvider>
            {children}
          </LenisProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

