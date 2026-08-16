import type { Config } from "tailwindcss";

export default {
  content: ["./public/**/*.html", "./public/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        // Warm charcoal "live music poster" palette: neon gold for
        // headings/brand, sunset orange for prices/tags.
        bg: "#121214",
        panel: "#1e1e24",
        "panel-2": "#25252c",
        brand: {
          DEFAULT: "#f4b41a",
          bright: "#ffc94d",
        },
        accent: "#e05314",
        cream: "#f5f5f7",
        muted: "#a0a0ab",
        red: "#c0392b",
        green: "#5c8a5c",
        border: "#2a2a32",
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
