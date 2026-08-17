import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import { reactClickToComponent } from 'vite-plugin-react-click-to-component'

export default defineConfig({
  plugins: [reactRouter(), reactClickToComponent()],
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
