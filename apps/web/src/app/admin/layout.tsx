import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HostNexus Admin",
  robots: { index: false, follow: false },
};

// Admin lives completely outside the main AuthProvider tree
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
