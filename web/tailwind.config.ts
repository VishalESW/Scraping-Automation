import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        faint: "var(--color-faint)",
        line: "var(--color-line)",
        linestrong: "var(--color-line-strong)",
        brand: "var(--color-accent)",
        brandhover: "var(--color-accent-hover)",
        accentweak: "var(--color-accent-weak)",
        paper: "var(--color-paper)",
        surface: "var(--color-surface)",
        surface2: "var(--color-surface-2)",
        surface3: "var(--color-surface-3)",
        pos: "var(--color-pos)",
        neg: "var(--color-neg)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        md: "var(--radius)",
        lg: "var(--radius-lg)",
        sm: "var(--radius-sm)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        card: "var(--shadow-card)",
        pop: "var(--shadow-pop)",
      },
    },
  },
  plugins: [],
};

export default config;
