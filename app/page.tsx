"use client";

import HeroSection from "./components/HeroSection";
import AboutSection from "./components/AboutSection";
import FeaturedVideoSection from "./components/FeaturedVideoSection";
import PhilosophySection from "./components/PhilosophySection";
import ServicesSection from "./components/ServicesSection";
import BuiltWithSection from "./components/BuiltWithSection";
import BackgroundVideo from "./components/BackgroundVideo";
import TiersSection from "./components/TiersSection";
import InstallSection from "./components/InstallSection";
import QuickStartSection from "./components/QuickStartSection";

export default function Home() {
  return (
    <main className="relative" style={{ background: "#050505" }}>
      {/* One continuous background video for the entire page */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <BackgroundVideo overlayOpacity={0.55} />
      </div>

      <div className="relative z-10" style={{ animation: "fadeInContent 0.8s ease 0.6s both" }}>
        <HeroSection />
        <QuickStartSection />
        <AboutSection />
        <TiersSection />
        <InstallSection />
        <FeaturedVideoSection />
        <PhilosophySection />
        <BuiltWithSection />
        <ServicesSection />
      </div>
    </main>
  );
}
