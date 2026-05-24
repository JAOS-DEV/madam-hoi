/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#b91c1c",
          gold: "#ca8a04",
          green: "#166534",
        },
      },
    },
  },
  plugins: [],
}

