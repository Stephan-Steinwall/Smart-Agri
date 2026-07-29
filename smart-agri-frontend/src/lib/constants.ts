// Shared constants for the AgriBot Smart Agriculture System

export const SUPPORTED_CROPS = [
  "Tomato",
  "Brinjal",
  "Chilli",
  "Maize",
  "Mango",
  "Onion",
  "Rice"
] as const;

export type SupportedCrop = (typeof SUPPORTED_CROPS)[number];
