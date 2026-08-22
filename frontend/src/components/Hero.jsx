import React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, WhatsappLogo, Sparkle, ArrowRight } from "@phosphor-icons/react";
import { waLink } from "@/lib/config";

const stat = (v, l) => ({ v, l });
const stats = [stat("7+", "Solution areas"), stat("100%", "Free consultation"), stat("Trichy", "Based in TN")];

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-white grain pt-28 pb-16 lg:pt-36 lg:pb-24">
      {/* soft decorative shapes */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand-green/10 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -left-32 h-96 w-96 rounded-full bg-navy/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-5 lg:px-8 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-navy/15 bg-navy/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-navy"
            data-testid="hero-badge"
          >
            <Sparkle size={15} weight="fill" className="text-brand-green" />
            AI-POWERED INSURANCE & BUSINESS ADVISORY
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-6 font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-navy"
            data-testid="hero-heading"
          >
            One Square.
            <br />
            <span className="text-brand-green">Every Solution.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-6 max-w-xl text-base sm:text-lg text-slate-600"
          >
            Health, motor, general and term insurance, plus loans, business solutions and AI automation —
            all handled by MSquare Care Solutions. Upload a policy or document and let our AI explain it in
            seconds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <a
              href="#contact"
              data-testid="hero-quote-btn"
              className="group inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 font-semibold text-white hover:bg-brand-greenDark hover:scale-[1.03] transition-[transform,background-color] duration-200 shadow-md"
            >
              Get a Free Quote
              <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-1" />
            </a>
            <a
              href={waLink()}
              target="_blank"
              rel="noreferrer"
              data-testid="hero-whatsapp-btn"
              className="inline-flex items-center gap-2 rounded-full border border-navy/20 bg-white px-6 py-3 font-semibold text-navy hover:bg-navy hover:text-white transition-colors duration-200"
            >
              <WhatsappLogo size={20} weight="fill" />
              Chat on WhatsApp
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex gap-8"
          >
            {stats.map((s) => (
              <div key={s.l}>
                <div className="font-display text-2xl font-bold text-navy">{s.v}</div>
                <div className="text-xs text-slate-500">{s.l}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right image cluster */}
        <div className="lg:col-span-6 relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative rounded-2xl overflow-hidden border border-navy/10 shadow-xl"
          >
            <img
              src="https://images.unsplash.com/photo-1758518730037-a16581a040e8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODB8MHwxfHNlYXJjaHwzfHxmaW5hbmNlJTIwY29uc3VsdGluZyUyMG1vZGVybnxlbnwwfHx8fDE3ODczNzIwMTd8MA&ixlib=rb-4.1.0&q=85"
              alt="MSquare Care advisory meeting"
              className="w-full h-[380px] lg:h-[460px] object-cover"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="absolute -bottom-5 -left-4 sm:left-6 bg-white rounded-xl shadow-lg border border-navy/10 p-4 flex items-center gap-3"
            data-testid="hero-trust-card"
          >
            <div className="h-11 w-11 rounded-lg bg-navy flex items-center justify-center">
              <ShieldCheck size={24} weight="fill" className="text-brand-green" />
            </div>
            <div>
              <div className="text-sm font-semibold text-navy">Trusted advisory</div>
              <div className="text-xs text-slate-500">Insurance & finance experts</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
