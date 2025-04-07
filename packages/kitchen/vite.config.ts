import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  build: {
    target: ["chrome89", "edge89", "firefox89", "safari15"],
    sourcemap: true,
  },
  plugins: [solid(), tailwindcss()],
});
