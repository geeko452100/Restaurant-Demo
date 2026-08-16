import type { Config } from "tailwindcss";

export default {
  content: ["./public/**/*.html", "./public/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        // Logo-matched palette: navy blue cards on a creamy beige
        // ground, standard navy nav, gold for brand accents.
        bg: "#f2e9d8",
        panel: "#1c2a4e",
        "panel-2": "#152140",
        brand: {
          DEFAULT: "#f4b41a",
          bright: "#ffc94d",
        },
        accent: "#e05314",
        cream: "#f5f0e4",
        muted: "#a9b4cf",
        red: "#c0392b",
        green: "#5c8a5c",
        border: "#2f3f6b",
        navy: {
          DEFAULT: "#1c2a4e",
          dark: "#152140",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Iowan Old Style", "serif"],
        sans: ["system-ui", "sans-serif"],
        display: ["Oswald", "Impact", "Haettenschweiler", "Arial Narrow Bold", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
