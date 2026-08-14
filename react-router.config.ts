import type { Config } from "@react-router/dev/config";

export default {
  // MVP ships as a static SPA. Runtime SSR can be enabled later without
  // rewriting the route modules.
  ssr: false,
} satisfies Config;
