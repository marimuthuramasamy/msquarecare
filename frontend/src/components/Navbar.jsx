import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { List, X } from "@phosphor-icons/react";
import { BrandHeader } from "./Logo";

const links = [
  { label: "Services", href: "#services" },
  { label: "AI Analyzer", href: "#analyzer" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 inset-x-0 z-50 transition-[background-color,box-shadow,border-color] duration-300 ${
        scrolled ? "bg-white/85 backdrop-blur-xl border-b border-navy/10 shadow-sm" : "bg-transparent"
      }`}
      data-testid="navbar"
    >
      <nav className="mx-auto max-w-7xl px-5 lg:px-8 h-16 flex items-center justify-between">
        <a href="#top" data-testid="nav-logo-link"><BrandHeader /></a>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              data-testid={`nav-link-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
              className="text-sm font-medium text-slate-600 hover:text-navy transition-colors duration-200"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#contact"
            data-testid="nav-quote-btn"
            className="rounded-full bg-brand-green px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-greenDark hover:scale-[1.03] transition-[transform,background-color] duration-200 shadow-sm"
          >
            Get a Free Quote
          </a>
        </div>

        <button
          className="md:hidden text-navy"
          onClick={() => setOpen((o) => !o)}
          data-testid="mobile-menu-toggle"
          aria-label="Toggle menu"
        >
          {open ? <X size={26} /> : <List size={26} />}
        </button>
      </nav>

      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="md:hidden bg-white border-t border-navy/10 overflow-hidden"
          data-testid="mobile-menu"
        >
          <div className="px-5 py-4 flex flex-col gap-3">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-slate-700 font-medium py-1"
                data-testid={`mobile-nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {l.label}
              </a>
            ))}
            <a href="#contact" onClick={() => setOpen(false)} className="rounded-full bg-brand-green px-5 py-2.5 text-center text-sm font-semibold text-white">
              Get a Free Quote
            </a>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}
