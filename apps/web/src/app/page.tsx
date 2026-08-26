import { Navbar } from "@/components/layout/navbar";
import { HeroSection } from "@/components/sections/hero";
import { StatsBar } from "@/components/sections/stats-bar";
import { ResourceCategories } from "@/components/sections/resource-categories";
import { HowItWorks } from "@/components/sections/how-it-works";
import { AiConciergePreview } from "@/components/sections/ai-concierge-preview";
import { TrustSection } from "@/components/sections/trust-section";
import { CtaSection } from "@/components/sections/cta-section";

export default function HomePage() {
  return (
    <div className="bg-[#FAFAF9]">
      <Navbar />
      <main>
        <HeroSection />
        <StatsBar />
        <ResourceCategories />
        <HowItWorks />
        <AiConciergePreview />
        <TrustSection />
        <CtaSection />
      </main>
    </div>
  );
}
