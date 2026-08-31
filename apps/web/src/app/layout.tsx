import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Outfit } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { LenisProvider } from "@/components/effects/lenis-provider";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HostNexus â€” B2B Marketplace for Hospitality Resource Sharing",
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
      className={`${plusJakarta.variable} ${outfit.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full bg-[#FAFAF9] text-[#1C1917] antialiased">
        <AuthProvider>
          <LenisProvider>
            {children}
          </LenisProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

