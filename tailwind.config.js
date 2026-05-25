/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#b91c1c",
          redDark: "#7f1d1d",
          gold: "#d4a017",
          cream: "#fff7e6",
          blush: "#ffe4d6",
          charcoal: "#2b2b2b",
        },
      },
    },
  },
  plugins: [],
}

