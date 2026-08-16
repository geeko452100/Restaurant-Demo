import type { Config } from "tailwindcss";

export default {
  content: ["./public/**/*.html", "./public/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        // Logo-matched palette: navy blue cards on a dark charcoal
        // ground (warmed toward brown for an old pub, whiskey-barrel
        // feel), royal blue (from the "Rhythm & Brews" wordmark) for
        // brand accents, deep maroon (from the logo's music staff) as
        // the secondary accent, and dark oak brown as a third accent.
        bg: "#211c18",
        panel: "#1c2a4e",
        "panel-2": "#152140",
        brand: {
          DEFAULT: "#3351db",
          bright: "#637be9",
        },
        accent: "#9e2e36",
        wood: {
          DEFAULT: "#4a3222",
          dark: "#2e1f15",
        },
        cream: "#fdfbf5",
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
