import React from "react";

const LOGO = `${process.env.PUBLIC_URL || ""}/logo.png`;
const LOGO_LIGHT = `${process.env.PUBLIC_URL || ""}/logo_transparent.png`;

// Exact MSquare Care Solutions logo image.
// `light` = true renders the transparent version for dark backgrounds.
export const LogoWordmark = ({ light = false, className = "" }) => (
  <img
    src={light ? LOGO_LIGHT : LOGO}
    alt="MSquare Care Solutions"
    data-testid="brand-logo"
    className={`h-12 w-auto object-contain select-none ${className}`}
    draggable="false"
  />
);

export const LogoMark = ({ light = false, className = "" }) => (
  <img
    src={light ? LOGO_LIGHT : LOGO}
    alt="MSquare Care Solutions"
    className={`h-10 w-auto object-contain ${className}`}
    draggable="false"
  />
);
