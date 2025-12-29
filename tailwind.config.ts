import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#0E7C7B",
          secondary: "#F4A261",
          surface: "#F7F7F2",
          accent: "#264653"
        }
      },
      borderRadius: {
        xl: "18px"
      },
      boxShadow: {
        card: "0 10px 30px rgba(0,0,0,0.08)"
      }
    }
  },
  plugins: []
};

export default config;
