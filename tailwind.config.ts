import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        "apple-soft":
          "0 24px 70px -36px rgba(15, 23, 42, 0.30), 0 8px 24px -18px rgba(15, 23, 42, 0.22)",
      },
      colors: {
        ink: "#1d1d1f",
      },
    },
  },
  plugins: [],
};

export default config;
