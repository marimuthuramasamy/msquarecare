import React from "react";
import { motion } from "framer-motion";
import {
  Heartbeat,
  Car,
  ShieldCheck,
  Users,
  CurrencyInr,
  Cpu,
  Umbrella,
  ArrowUpRight,
} from "@phosphor-icons/react";

const services = [
  {
    icon: Heartbeat,
    title: "Health Insurance",
    desc: "Cashless mediclaim, family floater & top-up plans tailored to your needs.",
    span: "lg:col-span-5",
    img: "https://images.pexels.com/photos/5998442/pexels-photo-5998442.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  },
  {
    icon: Car,
    title: "Motor Insurance",
    desc: "Car, bike & commercial vehicle cover with quick claim support.",
    span: "lg:col-span-4",
    img: "https://images.pexels.com/photos/2920064/pexels-photo-2920064.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  },
  {
    icon: ShieldCheck,
    title: "General Insurance",
    desc: "Home, shop, travel, marine & fire — protect what matters most.",
    span: "lg:col-span-3",
  },
  {
    icon: Umbrella,
    title: "Term / Life Insurance",
    desc: "High-cover term & life plans that secure your family's future.",
    span: "lg:col-span-4",
    img: "https://images.unsplash.com/photo-1648221350871-e3ae3c8d0f58?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzl8MHwxfHNlYXJjaHwzfHxmYW1pbHklMjBwcm90ZWN0aW9ufGVufDB8fHx8MTc4NzM3MjAxN3ww&ixlib=rb-4.1.0&q=85",
  },
  {
    icon: CurrencyInr,
    title: "Loans & Finance",
    desc: "Personal, home, business & vehicle loans at competitive rates.",
    span: "lg:col-span-4",
  },
  {
    icon: Users,
    title: "Business Solutions",
    desc: "GST, registrations, compliance & advisory for growing businesses.",
    span: "lg:col-span-4",
  },
  {
    icon: Cpu,
    title: "AI Automations",
    desc: "Smart workflows, chatbots & document AI to run your business faster.",
    span: "lg:col-span-4",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function Services() {
  return (
    <section id="services" className="relative bg-[#f8fafc] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-brand-green">WHAT WE DO</p>
          <h2 className="mt-3 font-display font-bold text-3xl lg:text-4xl text-navy">
            Every solution, under one square.
          </h2>
          <p className="mt-4 text-slate-600">
            From insurance and loans to compliance and AI, MSquare Care Solutions is your single trusted partner.
          </p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5"
        >
          {services.map((s) => {
            const Icon = s.icon;
            return (
              <motion.a
                key={s.title}
                variants={item}
                href="#contact"
                data-testid={`service-card-${s.title.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                className={`group relative overflow-hidden rounded-xl border border-navy/10 bg-white p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-[transform,box-shadow] duration-300 ${s.span}`}
              >
                {s.img && (
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <img src={s.img} alt={s.title} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-navy/80" />
                  </div>
                )}
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="h-12 w-12 rounded-lg bg-navy/5 group-hover:bg-white/15 flex items-center justify-center transition-colors duration-300">
                      <Icon size={26} weight="duotone" className="text-navy group-hover:text-white transition-colors duration-300" />
                    </div>
                    <ArrowUpRight size={20} className="text-slate-300 group-hover:text-brand-green transition-colors duration-300" />
                  </div>
                  <h3 className="mt-5 font-display text-xl font-semibold text-navy group-hover:text-white transition-colors duration-300">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 group-hover:text-white/85 transition-colors duration-300">
                    {s.desc}
                  </p>
                </div>
              </motion.a>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
