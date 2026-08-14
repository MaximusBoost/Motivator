import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home/home.tsx"),
  route("about", "routes/about/about.tsx"),
] satisfies RouteConfig;
