/** @type {import('tailwindcss').Config} */
// Colours are CSS variables (defined in src/global.css) so the whole palette
// flips between the light and dark "receipt" themes at the token level.
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        "paper-lit": "var(--paper-lit)",
        ink: "var(--ink)",
        carbon: "var(--carbon)",
        teal: "var(--teal)",
        "teal-deep": "var(--teal-deep)",
        amber: "var(--amber)",
        "amber-ink": "var(--amber-ink)",
        red: "var(--red)",
        manila: "var(--manila)",
        faded: "var(--faded)",
        "slip-muted": "var(--slip-muted)",
        "on-amber": "var(--on-amber)",
        hair: "var(--hair)",
      },
    },
  },
  plugins: [],
};
