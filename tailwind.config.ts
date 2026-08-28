import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bac-red": "#D2122E",
        "bac-red-dark": "#A30E24",
        "bac-gray-text": "#5B6472",
        "bac-gray-alt": "#F2F4F7",
        "bac-gray-border": "#E4E7EC",
        "bac-riesgo-critico": "#B91C1C",
        "bac-riesgo-alto": "#EA580C",
        "bac-riesgo-medio": "#CA8A04",
        "bac-riesgo-bajo": "#16A34A",
        "bac-riesgo-muy-bajo": "#0891B2",
        "bac-score-rojo": "#DC2626",
        "bac-score-amarillo": "#D97706",
        "bac-score-verde": "#16A34A",
      },
    },
  },
  plugins: [],
};

export default config;
