export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const WHATSAPP_NUMBER = "918072571879";
export const PHONE = "8072571879";
export const EMAIL = "msquarecare@gmail.com";
export const CITY = "Trichy, Tamil Nadu, India";

export const SERVICES = [
  "Health Insurance",
  "Motor Insurance",
  "General Insurance",
  "Term / Life Insurance",
  "Business Solutions",
  "Loans & Finance",
  "AI Automations",
];

export const waLink = (text) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text || "Hi MSquare Care, I'd like to know more about your services.")}`;
