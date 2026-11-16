import React from "react";

const BASE = process.env.PUBLIC_URL || "";

// Small, optimised renditions (WebP with PNG fallback) of the original logo files.
const Img = ({ name, ...props }) => (
  <picture>
    <source srcSet={`${BASE}/${name}.webp`} type="image/webp" />
    <img src={`${BASE}/${name}.small.png`} decoding="async" {...props} />
  </picture>
);

// Full exact logo image (mark + wordmark + tagline). Best on light backgrounds.
export const LogoWordmark = ({ className = "" }) => (
  <Img
    name="logo"
    width="230"
    height="160"
    alt="MSquare Care Solutions"
    data-testid="brand-logo"
    className={`h-14 w-auto object-contain select-none ${className}`}
    draggable="false"
  />
);

// Header lockup: icon mark from the logo + crisp company name text.
export const BrandHeader = ({ className = "" }) => (
  <div className={`flex items-center gap-2.5 ${className}`} data-testid="brand-header">
    <Img name="logo_icon" width="47" height="40" alt="" className="h-10 w-auto object-contain select-none" draggable="false" />
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
  <Img name="logo_icon" width="47" height="40" alt="MSquare Care Solutions" className={`h-10 w-auto object-contain ${className}`} draggable="false" />
);
