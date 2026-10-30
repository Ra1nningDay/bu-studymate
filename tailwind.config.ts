import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        bu: {
          purple: "#4b148c",
          ink: "#161326",
          cyan: "#16b8c8"
        }
      }
    }
  },
  plugins: []
};

export default config;
