import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Quicksand', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        gold: "hsl(var(--gold))",
        "gold-light": "hsl(var(--gold-light))",
        rose: "hsl(var(--rose))",
        "rose-light": "hsl(var(--rose-light))",
        "rose-dark": "hsl(var(--rose-dark))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "bounce-subtle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "glow": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(var(--gold) / 0.3)" },
          "50%": { boxShadow: "0 0 40px hsl(var(--gold) / 0.5)" },
        },
        breathing: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
        "glow-pulse-rosa": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(196, 96, 122, 0.3), 0 0 40px rgba(196, 96, 122, 0.1)" },
          "50%": { boxShadow: "0 0 30px rgba(196, 96, 122, 0.5), 0 0 60px rgba(196, 96, 122, 0.2)" },
        },
        "glow-pulse-gold": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(201, 149, 42, 0.3), 0 0 40px rgba(201, 149, 42, 0.1)" },
          "50%": { boxShadow: "0 0 30px rgba(201, 149, 42, 0.5), 0 0 60px rgba(201, 149, 42, 0.2)" },
        },
        "skeleton-shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "shimmer-sweep": {
          "0%": { left: "-100%" },
          "100%": { left: "100%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2s linear infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bounce-subtle": "bounce-subtle 2s ease-in-out infinite",
        "scale-in": "scale-in 0.2s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "float": "float 3s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite",
        breathing: "breathing 3s ease-in-out infinite",
        "glow-pulse-rosa": "glow-pulse-rosa 2.5s ease-in-out infinite",
        "glow-pulse-gold": "glow-pulse-gold 2s ease-in-out infinite",
        "skeleton-shimmer": "skeleton-shimmer 1.8s linear infinite",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
        "glass-hover": "0 12px 40px 0 rgba(31, 38, 135, 0.12)",
        gold: "0 4px 20px 0 rgba(201, 149, 42, 0.3)",
        rose: "0 4px 20px 0 rgba(196, 96, 122, 0.3)",
        "glow-rosa": "0 0 30px rgba(196, 96, 122, 0.3), 0 0 60px rgba(196, 96, 122, 0.1)",
        "glow-gold": "0 0 30px rgba(201, 149, 42, 0.3), 0 0 60px rgba(201, 149, 42, 0.1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
