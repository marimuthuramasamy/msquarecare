import React, { useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { PaperPlaneRight, WhatsappLogo, EnvelopeSimple, MapPin, Phone, CheckCircle } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { API, SERVICES, PHONE, EMAIL, CITY, waLink } from "@/lib/config";

const empty = { name: "", phone: "", email: "", service: "", city: "", message: "" };

export default function ContactForm() {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.service) {
      toast.error("Please fill in your name, phone and the service you need.");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/leads`, form);
      setDone(true);
      toast.success("Thank you! Our team will reach out to you shortly.");
      setForm(empty);
    } catch (err) {
      toast.error("Something went wrong. Please try WhatsApp instead.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" className="bg-[#f8fafc] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8 grid lg:grid-cols-12 gap-10">
        {/* Left info */}
        <div className="lg:col-span-5">
          <p className="text-xs font-semibold tracking-[0.2em] text-brand-green">GET IN TOUCH</p>
          <h2 className="mt-3 font-display font-bold text-3xl lg:text-4xl text-navy">
            Request a free quote today.
          </h2>
          <p className="mt-4 text-slate-600">
            Tell us what you need and we'll get back with the best options. Prefer to talk? Reach us directly.
          </p>

          <div className="mt-8 space-y-4">
            <a href={`tel:${PHONE}`} className="flex items-center gap-4 group" data-testid="contact-phone">
              <span className="h-11 w-11 rounded-lg bg-navy/5 flex items-center justify-center group-hover:bg-navy transition-colors duration-200">
                <Phone size={20} weight="fill" className="text-navy group-hover:text-white transition-colors duration-200" />
              </span>
              <div>
                <div className="text-xs text-slate-500">Call us</div>
                <div className="font-semibold text-navy">{PHONE}</div>
              </div>
            </a>
            <a href={`mailto:${EMAIL}`} className="flex items-center gap-4 group" data-testid="contact-email">
              <span className="h-11 w-11 rounded-lg bg-navy/5 flex items-center justify-center group-hover:bg-navy transition-colors duration-200">
                <EnvelopeSimple size={20} weight="fill" className="text-navy group-hover:text-white transition-colors duration-200" />
              </span>
              <div>
                <div className="text-xs text-slate-500">Email</div>
                <div className="font-semibold text-navy">{EMAIL}</div>
              </div>
            </a>
            <div className="flex items-center gap-4" data-testid="contact-location">
              <span className="h-11 w-11 rounded-lg bg-navy/5 flex items-center justify-center">
                <MapPin size={20} weight="fill" className="text-navy" />
              </span>
              <div>
                <div className="text-xs text-slate-500">Location</div>
                <div className="font-semibold text-navy">{CITY}</div>
              </div>
            </div>
            <a
              href={waLink()}
              target="_blank"
              rel="noreferrer"
              data-testid="contact-whatsapp-btn"
              className="inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-3 font-semibold text-white hover:bg-brand-greenDark transition-colors duration-200"
            >
              <WhatsappLogo size={20} weight="fill" /> Message us on WhatsApp
            </a>
          </div>
        </div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-7 rounded-2xl bg-white border border-navy/10 shadow-md p-6 lg:p-8"
        >
          {done ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16" data-testid="contact-success">
              <CheckCircle size={56} weight="fill" className="text-brand-green" />
              <h3 className="mt-4 font-display text-2xl font-bold text-navy">Request received!</h3>
              <p className="mt-2 text-slate-600 max-w-sm">
                Thanks for reaching out to MSquare Care Solutions. Our consultant will contact you soon.
              </p>
              <button
                onClick={() => setDone(false)}
                className="mt-6 rounded-full border border-navy/20 px-5 py-2.5 font-semibold text-navy hover:bg-navy hover:text-white transition-colors duration-200"
                data-testid="contact-another-btn"
              >
                Submit another request
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid sm:grid-cols-2 gap-5" data-testid="contact-form">
              <div>
                <Label htmlFor="name" className="text-navy">Full name *</Label>
                <Input id="name" data-testid="input-name" value={form.name} onChange={set("name")} placeholder="Your name" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="phone" className="text-navy">Phone *</Label>
                <Input id="phone" data-testid="input-phone" value={form.phone} onChange={set("phone")} placeholder="Mobile number" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="email" className="text-navy">Email</Label>
                <Input id="email" data-testid="input-email" type="email" value={form.email} onChange={set("email")} placeholder="you@email.com" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="city" className="text-navy">City</Label>
                <Input id="city" data-testid="input-city" value={form.city} onChange={set("city")} placeholder="Your city" className="mt-1.5" />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-navy">Service needed *</Label>
                <Select value={form.service} onValueChange={set("service")}>
                  <SelectTrigger className="mt-1.5" data-testid="select-service">
                    <SelectValue placeholder="Choose a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICES.map((s) => (
                      <SelectItem key={s} value={s} data-testid={`service-option-${s.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="message" className="text-navy">Message</Label>
                <Textarea id="message" data-testid="input-message" value={form.message} onChange={set("message")} placeholder="Tell us a little about what you need…" className="mt-1.5 min-h-[110px]" />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={loading}
                  data-testid="contact-submit-btn"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-navy px-6 py-3.5 font-semibold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors duration-200"
                >
                  {loading ? "Sending…" : "Request my free quote"}
                  {!loading && <PaperPlaneRight size={18} weight="fill" />}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
