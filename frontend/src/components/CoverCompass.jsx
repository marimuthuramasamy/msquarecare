import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heartbeat,
  Car,
  House,
  Umbrella,
  Buildings,
  ArrowLeft,
  ArrowRight,
  WhatsappLogo,
  ArrowClockwise,
  Compass,
} from "@phosphor-icons/react";
import { waLink } from "@/lib/config";

// Step 1: what to protect. Step 2: one follow-up that tailors the advice.
// Each answer maps to one of the SERVICES names used by the contact form.
const TOPICS = [
  {
    id: "health",
    icon: Heartbeat,
    label: "My family's health",
    service: "Health Insurance",
    q: "Who should the plan cover?",
    options: [
      { label: "Just me", tip: "An individual plan keeps the premium low. Add a top-up later as medical costs grow." },
      { label: "Me and my spouse", tip: "A family floater shares one sum insured between you both, usually cheaper than two separate plans." },
      { label: "Family with parents", tip: "Insure parents on a separate policy so their claims don't use up the family floater, and check waiting periods for existing conditions." },
    ],
  },
  {
    id: "motor",
    icon: Car,
    label: "My vehicle",
    service: "Motor Insurance",
    q: "What are you insuring?",
    options: [
      { label: "Two-wheeler", tip: "Compare third-party-only against comprehensive cover. Comprehensive protects your own bike too." },
      { label: "Car", tip: "Comprehensive cover with zero-depreciation add-on is worth comparing, especially for newer cars." },
      { label: "Commercial vehicle", tip: "Commercial vehicles need cover matched to how they're used. We'll check permit and goods-carrying terms." },
    ],
  },
  {
    id: "home",
    icon: House,
    label: "My home or shop",
    service: "General Insurance",
    q: "What needs protecting?",
    options: [
      { label: "Home", tip: "Cover the structure and, separately, the contents. Fire, flood and theft are the usual perils to check." },
      { label: "Shop or office", tip: "A shopkeeper's or office policy covers stock, fittings and fire. Business interruption can be added." },
      { label: "A trip", tip: "Travel cover helps with medical emergencies, baggage and trip delays. Match it to your destination." },
    ],
  },
  {
    id: "life",
    icon: Umbrella,
    label: "My family's future",
    service: "Term / Life Insurance",
    q: "What matters most?",
    options: [
      { label: "Replace my income", tip: "A pure term plan gives the highest cover for the lowest premium. It's the usual starting point for income protection." },
      { label: "Children's education", tip: "Pair term cover with a long-term goal plan so education funds are protected even if you aren't around." },
      { label: "Clear my loans", tip: "Make sure your cover is at least enough to clear outstanding loans, so your family isn't left with the debt." },
    ],
  },
  {
    id: "business",
    icon: Buildings,
    label: "My business",
    service: "Business Solutions",
    q: "Where do you need help?",
    options: [
      { label: "Starting up", tip: "We help with registrations, GST and getting the paperwork right from day one." },
      { label: "Funding or a loan", tip: "We'll help you prepare documents and compare business loan options.", service: "Loans & Finance" },
      { label: "Saving time with AI", tip: "Chatbots, document reading and workflow automation can remove repetitive work.", service: "AI Automations" },
    ],
  },
];

export default function CoverCompass() {
  const [topic, setTopic] = useState(null);
  const [answer, setAnswer] = useState(null);

  const reset = () => {
    setTopic(null);
    setAnswer(null);
  };

  const service = answer?.service || topic?.service;
  const step = !topic ? 1 : !answer ? 2 : 3;

  const goContact = () => {
    window.dispatchEvent(new CustomEvent("msq:prefill", { detail: { service } }));
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="compass" className="relative bg-white py-20 lg:py-28" aria-labelledby="compass-heading">
      <div className="mx-auto max-w-7xl px-5 lg:px-8 grid lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-5">
          <p className="text-xs font-semibold tracking-[0.2em] text-brand-green flex items-center gap-2">
            <Compass size={16} weight="duotone" /> COVER COMPASS
          </p>
          <h2 id="compass-heading" className="mt-3 font-display font-bold text-3xl lg:text-4xl text-navy">
            Not sure where to start? Two taps.
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Answer two quick questions and we'll point you to the right solution, with plain-language advice and no
            jargon. No sign-up and no data stored.
          </p>
          <ol className="mt-8 flex gap-2" aria-label="Progress">
            {[1, 2, 3].map((n) => (
              <li
                key={n}
                aria-current={step === n ? "step" : undefined}
                className={`h-1.5 flex-1 transition-colors duration-300 ${step >= n ? "bg-brand-green" : "bg-navy/10"}`}
              >
                <span className="sr-only">Step {n}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="lg:col-span-7 border border-navy/10 bg-[#f8fafc] p-6 sm:p-8 min-h-[340px]" data-testid="cover-compass">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="s1"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                <h3 className="font-display text-xl font-semibold text-navy">What would you like to protect?</h3>
                <div className="mt-5 grid sm:grid-cols-2 gap-3">
                  {TOPICS.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTopic(t)}
                        data-testid={`compass-topic-${t.id}`}
                        className="group flex items-center gap-3 border border-navy/10 bg-white p-4 text-left hover:border-navy hover:bg-navy hover:text-white transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                      >
                        <Icon size={26} weight="duotone" className="text-navy group-hover:text-white shrink-0" />
                        <span className="font-medium text-navy group-hover:text-white">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="s2"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-navy"
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <h3 className="mt-3 font-display text-xl font-semibold text-navy">{topic.q}</h3>
                <div className="mt-5 grid gap-3">
                  {topic.options.map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      onClick={() => setAnswer(o)}
                      className="flex items-center justify-between border border-navy/10 bg-white p-4 text-left hover:border-navy hover:bg-navy hover:text-white transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
                    >
                      <span className="font-medium">{o.label}</span>
                      <ArrowRight size={18} />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="s3"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                aria-live="polite"
                data-testid="compass-result"
              >
                <p className="text-xs font-semibold tracking-[0.2em] text-slate-500">WE SUGGEST</p>
                <h3 className="mt-2 font-display text-2xl font-bold text-navy">{service}</h3>
                <p className="mt-3 text-slate-700 leading-relaxed">{answer.tip}</p>
                <p className="mt-3 text-xs text-slate-500">
                  General guidance only. We'll confirm the right plan and compare insurers for you.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={goContact}
                    data-testid="compass-quote-btn"
                    className="inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 font-semibold text-white hover:bg-brand-greenDark transition-colors duration-200"
                  >
                    Get a free quote <ArrowRight size={18} />
                  </button>
                  <a
                    href={waLink(`Hi MSquare Care, I'm looking for ${service} (${answer.label}). Can you help?`)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-navy/20 bg-white px-6 py-3 font-semibold text-navy hover:bg-navy hover:text-white transition-colors duration-200"
                  >
                    <WhatsappLogo size={20} weight="fill" /> Ask on WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-2 px-3 py-3 text-sm text-slate-600 hover:text-navy"
                  >
                    <ArrowClockwise size={16} /> Start over
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
