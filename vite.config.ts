import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Only include VITE_ prefixed environment variables for the client
  const clientEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('VITE_')) {
      clientEnv[`import.meta.env.${key}`] = JSON.stringify(value);
    }
  }

  return {
    root: ".",
    publicDir: "./public",
    plugins: [react()],
    define: {
      ...clientEnv,
      'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production')
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      open: true, // Automatically open the browser
      host: true, // Allow access from other devices on the network
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: "./dist/frontend",
      emptyOutDir: true,
      rollupOptions: {
        input: "./src/frontend/index.html"
      }
    }
  };
});
