import React from "react";
import { motion } from "framer-motion";
import { WhatsappLogo } from "@phosphor-icons/react";
import { waLink } from "@/lib/config";

export default function WhatsAppButton() {
  return (
    <motion.a
      href={waLink()}
      target="_blank"
      rel="noreferrer"
      data-testid="floating-whatsapp-btn"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1, type: "spring", stiffness: 200 }}
      whileHover={{ scale: 1.08 }}
      className="fixed bottom-6 left-6 z-40 h-14 w-14 rounded-full bg-brand-green shadow-lg shadow-brand-green/40 flex items-center justify-center"
      aria-label="Chat on WhatsApp"
    >
      <span className="absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-40 animate-ping" />
      <WhatsappLogo size={30} weight="fill" className="relative text-white" />
    </motion.a>
  );
}
