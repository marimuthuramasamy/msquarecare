import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatCircleDots, X, PaperPlaneRight, Robot } from "@phosphor-icons/react";
import { API } from "@/lib/config";

const uid = () => Math.random().toString(36).slice(2);
const GREETING = {
  role: "assistant",
  content: "Hi! I'm MSquare Assist 👋 Ask me about health, motor, general or term insurance, loans, or business services.",
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionId = useRef(uid());
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId.current, message: text }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content: copy[copy.length - 1].content + chunk,
          };
          return copy;
        });
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "Sorry, I couldn't respond. Please reach us on WhatsApp 8072571879.",
        };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        data-testid="chat-toggle-btn"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.2, type: "spring", stiffness: 200 }}
        whileHover={{ scale: 1.08 }}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-navy shadow-lg shadow-navy/40 flex items-center justify-center text-white"
        aria-label="Open chat"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ opacity: 0 }}>
              <X size={26} />
            </motion.span>
          ) : (
            <motion.span key="c" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ opacity: 0 }}>
              <ChatCircleDots size={28} weight="fill" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-24 right-6 z-40 w-[92vw] max-w-[380px] h-[520px] rounded-2xl bg-white shadow-2xl border border-navy/10 flex flex-col overflow-hidden"
            data-testid="chat-window"
          >
            <div className="bg-navy px-4 py-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-brand-green flex items-center justify-center">
                <Robot size={20} weight="fill" className="text-white" />
              </div>
              <div>
                <div className="text-white font-semibold text-sm">MSquare Assist</div>
                <div className="text-white/60 text-xs">Typically replies instantly</div>
              </div>
            </div>

            <div ref={scrollRef} className="chat-scroll flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8fafc]">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    data-testid={`chat-msg-${m.role}`}
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-navy text-white rounded-br-sm"
                        : "bg-white border border-navy/10 text-slate-700 rounded-bl-sm"
                    }`}
                  >
                    {m.content || (busy && i === messages.length - 1 ? "…" : "")}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-navy/10 flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Type your question…"
                data-testid="chat-input"
                className="flex-1 rounded-full border border-navy/15 px-4 py-2.5 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
              />
              <button
                onClick={send}
                disabled={busy}
                data-testid="chat-send-btn"
                className="h-10 w-10 rounded-full bg-brand-green flex items-center justify-center text-white hover:bg-brand-greenDark disabled:opacity-50 transition-colors duration-200"
              >
                <PaperPlaneRight size={18} weight="fill" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
