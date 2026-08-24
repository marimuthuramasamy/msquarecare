import React from "react";

const LOGO = `${process.env.PUBLIC_URL || ""}/logo.png`;
const LOGO_ICON = `${process.env.PUBLIC_URL || ""}/logo_icon.png`;

// Full exact logo image (mark + wordmark + tagline). Best on light backgrounds.
export const LogoWordmark = ({ className = "" }) => (
  <img
    src={LOGO}
    alt="MSquare Care Solutions"
    data-testid="brand-logo"
    className={`h-14 w-auto object-contain select-none ${className}`}
    draggable="false"
  />
);

// Header lockup: icon mark from the logo + crisp company name text.
export const BrandHeader = ({ className = "" }) => (
  <div className={`flex items-center gap-2.5 ${className}`} data-testid="brand-header">
    <img src={LOGO_ICON} alt="" className="h-10 w-auto object-contain select-none" draggable="false" />
    <div className="leading-none">
      <div className="font-display font-extrabold text-[19px] sm:text-[21px] tracking-tight">
        <span className="text-navy">MSquare</span>
        <span className="text-brand-green">Care</span>
      </div>
      <div className="text-[9px] font-semibold tracking-[0.3em] text-slate-500 mt-1">
        SOLUTIONS
      </div>
    </div>
  </div>
);

export const LogoMark = ({ className = "" }) => (
  <img src={LOGO_ICON} alt="MSquare Care Solutions" className={`h-10 w-auto object-contain ${className}`} draggable="false" />
);
