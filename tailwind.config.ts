/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        navy: "#0F172A",
        teal: "#2DD4BF",
        coral: "#FF5A5F",
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
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
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
        launch: {
          "0%": { transform: "translateY(24px) translateX(-50%) scale(0.9)", opacity: "0" },
          "8%": { opacity: "1", transform: "translateY(16px) translateX(-50%) scale(0.95)" },
          "35%": { transform: "translateY(-32px) translateX(-50%) scale(1)" },
          "55%": { transform: "translateY(-56px) translateX(-48%) scale(1) rotate(-2deg)" },
          "70%": { opacity: "1" },
          "85%": { opacity: "0", transform: "translateY(-110px) translateX(-52%) scale(0.96) rotate(3deg)" },
          "100%": { opacity: "0", transform: "translateY(24px) translateX(-50%) scale(0.9)" },
        },
        flame: {
          "0%, 100%": { transform: "scaleY(1) scaleX(1)", opacity: "0.9" },
          "50%": { transform: "scaleY(1.3) scaleX(0.9)", opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-12px) rotate(5deg)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.4", transform: "scale(0.8)" },
          "50%": { opacity: "1", transform: "scale(1.1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        launch: "launch 4.2s cubic-bezier(0.22, 1, 0.36, 1) infinite",
        flame: "flame 0.12s infinite",
        "float-1": "float 5s ease-in-out infinite",
        "float-2": "float 6s ease-in-out infinite 1s",
        "float-3": "float 5.5s ease-in-out infinite 0.5s",
        "float-4": "float 7s ease-in-out infinite 1.5s",
        twinkle: "twinkle 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}