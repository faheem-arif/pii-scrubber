import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101820",
        fog: "#f7f4ef",
        brass: "#d4a017",
        dusk: "#3b2f2f",
        slate: "#3b4652"
      },
      boxShadow: {
        soft: "0 18px 50px -32px rgba(0,0,0,0.45)"
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        rise: "rise 0.6s ease-out both"
      }
    }
  },
  plugins: []
};

export default config;
