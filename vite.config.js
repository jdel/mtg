import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        searching: fileURLToPath(new URL("./searching/index.html", import.meta.url)),
      },
    },
  },
  plugins: [
    {
      name: "searching-trailing-slash",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url !== "/searching") return next();
          response.writeHead(308, { Location: "/searching/" });
          response.end();
        });
      },
    },
    react(),
  ],
});
