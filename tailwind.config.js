/** @type {import('tailwindcss').Config} */
const c = (v) => `oklch(var(--${v}) / <alpha-value>)`;

module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Preflight stays off so the older pages (login, register, KYC...) keep their current look.
  // New pages opt in to a scoped reset with the `tw` class (see globals.css).
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        background: c("background"),
        foreground: c("foreground"),
        primary: { DEFAULT: c("primary"), foreground: c("primary-foreground") },
        muted: { DEFAULT: c("muted"), foreground: c("muted-foreground") },
        destructive: c("destructive"),
        border: c("border"),
        cream: c("cream"),
        ink: { DEFAULT: c("ink"), foreground: c("ink-foreground") },
      },
      // Same radius scale as Najm (base 1rem)
      borderRadius: {
        sm: "0.75rem",
        md: "0.875rem",
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "1.75rem",
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};
