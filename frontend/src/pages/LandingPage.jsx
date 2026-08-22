import React from "react";
import SmoothScroll from "@/components/SmoothScroll";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import DocumentAnalyzer from "@/components/DocumentAnalyzer";
import About from "@/components/About";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import WhatsAppButton from "@/components/WhatsAppButton";

export default function LandingPage() {
  return (
    <SmoothScroll>
      <div data-testid="landing-page">
        <Navbar />
        <main>
          <Hero />
          <Services />
          <DocumentAnalyzer />
          <About />
          <ContactForm />
        </main>
        <Footer />
        <WhatsAppButton />
        <ChatWidget />
      </div>
    </SmoothScroll>
  );
}
