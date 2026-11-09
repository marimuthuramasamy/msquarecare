import React, { lazy, Suspense } from "react";
import SmoothScroll from "@/components/SmoothScroll";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import CoverCompass from "@/components/CoverCompass";
const DocumentAnalyzer = lazy(() => import("@/components/DocumentAnalyzer"));
import About from "@/components/About";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
const ChatWidget = lazy(() => import("@/components/ChatWidget"));
import WhatsAppButton from "@/components/WhatsAppButton";

export default function LandingPage() {
  return (
    <SmoothScroll>
      <div data-testid="landing-page">
        <Navbar />
        <main>
          <Hero />
          <Services />
          <CoverCompass />
          <Suspense fallback={<div id="analyzer" className="min-h-[400px]" />}>
            <DocumentAnalyzer />
          </Suspense>
          <About />
          <ContactForm />
        </main>
        <Footer />
        <WhatsAppButton />
        <Suspense fallback={null}>
          <ChatWidget />
        </Suspense>
      </div>
    </SmoothScroll>
  );
}
