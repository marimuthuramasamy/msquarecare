import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadSimple, FileMagnifyingGlass, Sparkle, X, ArrowClockwise } from "@phosphor-icons/react";
import { toast } from "@/components/ui/sonner";
import { API } from "@/lib/config";

const CONTEXTS = [
  "Health policy",
  "Motor policy / RC",
  "Term / Life policy",
  "Medical report",
  "Vehicle damage photo",
  "Loan / Bank statement",
];

// tiny markdown renderer for headings + bullets + bold
function renderMarkdown(md) {
  const blocks = md.split("\n");
  const out = [];
  let list = [];
  const flush = (k) => {
    if (list.length) {
      out.push(
        <ul key={`ul-${k}`} className="my-2 space-y-1.5 pl-1">
          {list.map((li, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-green" />
              <span dangerouslySetInnerHTML={{ __html: bold(li) }} />
            </li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  const bold = (t) => t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  blocks.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("## ")) {
      flush(i);
      out.push(
        <h4 key={i} className="mt-4 mb-1 font-display text-base font-semibold text-navy">
          {t.replace("## ", "")}
        </h4>
      );
    } else if (t.startsWith("- ") || t.startsWith("* ")) {
      list.push(t.slice(2));
    } else if (t) {
      flush(i);
      out.push(<p key={i} className="text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: bold(t) }} />);
    }
  });
  flush("end");
  return out;
}

export default function DocumentAnalyzer() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const pick = (f) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please upload an image (JPG or PNG).");
      return;
    }
    setFile(f);
    setResult(null);
    setPreview(URL.createObjectURL(f));
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setContext("");
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("context", context);
      const res = await fetch(`${API}/analyze-image`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setResult(data.analysis);
    } catch (e) {
      toast.error("Could not analyze the image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="analyzer" className="relative bg-navy py-20 lg:py-28 overflow-hidden grain">
      <div className="pointer-events-none absolute -top-32 right-10 h-96 w-96 rounded-full bg-brand-green/20 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-5 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-brand-green">AI DOCUMENT ANALYZER</p>
          <h2 className="mt-3 font-display font-bold text-3xl lg:text-4xl text-white">
            Upload any policy or document. Understand it instantly.
          </h2>
          <p className="mt-4 text-white/70">
            Snap a photo of your insurance policy, RC book, medical report or vehicle damage — our AI reads it
            and explains everything in plain language.
          </p>
        </div>

        <div className="mt-10 grid lg:grid-cols-2 gap-6">
          {/* Upload panel */}
          <div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/15 p-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {CONTEXTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setContext(c)}
                  data-testid={`analyzer-context-${c.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                    context === c ? "bg-brand-green text-white" : "bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pick(e.dataTransfer.files?.[0]);
              }}
              onClick={() => !preview && inputRef.current?.click()}
              data-testid="analyzer-dropzone"
              className="relative rounded-xl border-2 border-dashed border-white/25 bg-navy-dark/40 min-h-[280px] flex items-center justify-center overflow-hidden cursor-pointer"
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                data-testid="analyzer-file-input"
                onChange={(e) => pick(e.target.files?.[0])}
              />
              {!preview ? (
                <div className="text-center px-6 py-10">
                  <UploadSimple size={40} className="mx-auto text-brand-green" />
                  <p className="mt-3 text-white font-medium">Drop an image here or click to upload</p>
                  <p className="text-xs text-white/50 mt-1">JPG or PNG · max ~10MB</p>
                </div>
              ) : (
                <>
                  <img src={preview} alt="preview" className="w-full h-[280px] object-contain" />
                  {loading && (
                    <motion.div
                      initial={{ top: 0 }}
                      animate={{ top: ["0%", "100%", "0%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute left-0 right-0 h-1 bg-brand-green shadow-[0_0_20px_6px_rgba(58,169,53,0.7)]"
                    />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      reset();
                    }}
                    data-testid="analyzer-clear-btn"
                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-navy/70 text-white flex items-center justify-center hover:bg-navy"
                  >
                    <X size={16} />
                  </button>
                </>
              )}
            </div>

            <button
              onClick={analyze}
              disabled={!file || loading}
              data-testid="analyzer-run-btn"
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-green px-6 py-3 font-semibold text-white hover:bg-brand-greenDark disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? (
                <>
                  <ArrowClockwise size={18} className="animate-spin" /> Analyzing…
                </>
              ) : (
                <>
                  <FileMagnifyingGlass size={18} weight="fill" /> Analyze with AI
                </>
              )}
            </button>
          </div>

          {/* Result panel */}
          <div className="rounded-2xl bg-white border border-white/15 p-6 min-h-[280px]" data-testid="analyzer-result">
            <div className="flex items-center gap-2 text-navy">
              <Sparkle size={18} weight="fill" className="text-brand-green" />
              <span className="font-display font-semibold">AI Analysis</span>
            </div>
            <div className="mt-4 chat-scroll max-h-[360px] overflow-y-auto pr-1">
              <AnimatePresence mode="wait">
                {loading && (
                  <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-4 rounded bg-slate-100 animate-pulse" style={{ width: `${90 - i * 8}%` }} />
                    ))}
                  </motion.div>
                )}
                {!loading && result && (
                  <motion.div key="res" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    {renderMarkdown(result)}
                  </motion.div>
                )}
                {!loading && !result && (
                  <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-slate-400">
                    Your document breakdown will appear here — what it is, key details, what it means for you, and
                    the recommended next step.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
