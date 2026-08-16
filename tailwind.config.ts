import type { Config } from "tailwindcss";

export default {
  content: ["./public/**/*.html", "./public/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        // Palette anchored to the real Rhythm & Brews logo (navy blue
        // script, black bottle cap, red music-staff accent) rather than
        // an invented amber taproom theme.
        bg: "#0c0e13",
        panel: "#151822",
        "panel-2": "#1c202c",
        brand: {
          DEFAULT: "#1d3fc4",
          bright: "#3d5eeb",
        },
        cream: "#f3f5f9",
        muted: "#98a1b5",
        red: "#c0392b",
        green: "#5c8a5c",
        border: "#2a2f3d",
      },
      fontFamily: {
        serif: ["Georgia", "Iowan Old Style", "serif"],
        sans: ["system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
