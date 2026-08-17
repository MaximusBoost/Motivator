import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import { reactClickToComponent } from "vite-plugin-react-click-to-component";

import { localAiPlugin } from "./server/local-ai-plugin.ts";

export default defineConfig({
  plugins: [localAiPlugin(), reactRouter(), reactClickToComponent()],
  resolve: {
    tsconfigPaths: true,
  },
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: ["./app/styles"],
        additionalData: '@use "variables" as *;\n',
      },
    },
  },
});
