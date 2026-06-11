import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        align: {
          void: "#020617",
          panel: "#0f172a",
          line: "#1e293b",
          action: "#10b981",
          actionDark: "#047857",
        },
      },
      boxShadow: {
        terminal: "0 0 0 1px rgba(148,163,184,.2), 0 18px 60px rgba(2,6,23,.34)",
      },
    },
  },
  plugins: [],
};

export default config;
