import React from "react";
import { motion } from "framer-motion";
import { CheckCircle, Phone } from "@phosphor-icons/react";
import { PHONE } from "@/lib/config";

const points = [
  "Personalised, unbiased advice across multiple insurers",
  "End-to-end claim assistance — we handle the paperwork",
  "One trusted point of contact for insurance, loans & business",
  "Fast digital onboarding with AI-powered document reading",
];

export default function About() {
  return (
    <section id="about" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          <div className="rounded-2xl overflow-hidden border border-navy/10 shadow-lg">
            <img
              src="https://images.pexels.com/photos/5816284/pexels-photo-5816284.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
              alt="Reviewing financial reports"
              className="w-full h-[420px] object-cover"
            />
          </div>
          <div className="absolute -bottom-6 right-6 bg-navy text-white rounded-xl p-5 shadow-xl max-w-[220px]">
            <div className="font-display text-lg font-bold">MSquare Care</div>
            <div className="text-xs text-white/70">Insurance & Business Consultants</div>
            <a href={`tel:${PHONE}`} className="mt-3 inline-flex items-center gap-2 text-sm text-brand-green font-semibold" data-testid="about-call-link">
              <Phone size={16} weight="fill" /> {PHONE}
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-xs font-semibold tracking-[0.2em] text-brand-green">WHY MSQUARE CARE</p>
          <h2 className="mt-3 font-display font-bold text-3xl lg:text-4xl text-navy">
            A trusted partner that puts your peace of mind first.
          </h2>
          <p className="mt-5 text-slate-600 leading-relaxed">
            Based in Trichy, Tamil Nadu, MSquare Care Solutions helps families and businesses choose the right
            protection and financial products — without the jargon. We combine human expertise with modern AI
            tools so you always understand exactly what you're buying.
          </p>
          <ul className="mt-7 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3" data-testid="about-point">
                <CheckCircle size={22} weight="fill" className="text-brand-green shrink-0 mt-0.5" />
                <span className="text-slate-700">{p}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
