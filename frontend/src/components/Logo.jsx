import React from "react";

// Brand mark for MSquare Care Solutions — navy square with green "M" motif
export const LogoMark = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="3" y="3" width="58" height="58" rx="10" fill="#ffffff" stroke="#1a2f6b" strokeWidth="4" />
    <path d="M16 46V20l10 14 10-14v26" stroke="#1a2f6b" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <rect x="38" y="34" width="12" height="12" rx="2" fill="#3aa935" />
  </svg>
);

export const LogoWordmark = ({ light = false, className = "" }) => (
  <div className={`flex items-center gap-2.5 ${className}`} data-testid="brand-logo">
    <LogoMark size={38} />
    <div className="leading-none">
      <div className="font-display font-extrabold text-[19px] tracking-tight">
        <span style={{ color: light ? "#ffffff" : "#1a2f6b" }}>MSquare</span>
        <span style={{ color: "#3aa935" }}>Care</span>
      </div>
      <div
        className="text-[9px] font-semibold tracking-[0.32em] mt-0.5"
        style={{ color: light ? "rgba(255,255,255,0.65)" : "#475569" }}
      >
        SOLUTIONS
      </div>
    </div>
  </div>
);
