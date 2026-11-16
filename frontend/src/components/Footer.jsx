import React from "react";
import { WhatsappLogo, EnvelopeSimple, MapPin, Phone } from "@phosphor-icons/react";
import { LogoWordmark } from "./Logo";
import { PHONE, EMAIL, CITY, waLink, SERVICES } from "@/lib/config";

export default function Footer() {
  return (
    <footer className="bg-[#eef2f8] text-slate-700 py-16 lg:py-20 border-t border-navy/10">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <LogoWordmark />
            <p className="mt-4 text-sm text-slate-600 max-w-sm">
              One Square. Every Solution. Your trusted partner for insurance, loans, business services and AI
              automation in Trichy, Tamil Nadu.
            </p>
            <a
              href={waLink()}
              target="_blank"
              rel="noreferrer"
              data-testid="footer-whatsapp"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-greenDark transition-colors duration-200"
            >
              <WhatsappLogo size={18} weight="fill" /> Chat on WhatsApp
            </a>
          </div>

          <div className="md:col-span-4">
            <h4 className="font-display font-semibold text-navy">Our Services</h4>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {SERVICES.map((s) => (
                <li key={s}>
                  <a href="#services" className="hover:text-brand-greenDark transition-colors duration-200">{s}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h4 className="font-display font-semibold text-navy">Contact</h4>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex items-center gap-2"><Phone size={16} weight="fill" className="text-brand-green" /><a href={`tel:${PHONE}`} className="hover:text-navy">{PHONE}</a></li>
              <li className="flex items-center gap-2"><EnvelopeSimple size={16} weight="fill" className="text-brand-green" /><a href={`mailto:${EMAIL}`} className="hover:text-navy">{EMAIL}</a></li>
              <li className="flex items-start gap-2"><MapPin size={16} weight="fill" className="text-brand-green mt-0.5" /><span>{CITY}</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-navy/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} MSquare Care Solutions. All rights reserved.</span>
          <div className="flex items-center gap-5">
            <a href="/my-policy" data-testid="footer-portal-link" className="hover:text-navy transition-colors duration-200">My Policy</a>
            <a href="/crm" data-testid="footer-admin-link" className="hover:text-navy transition-colors duration-200">Staff login</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
