import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const workspaceRoot = path.resolve(__dirname, "..");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@paperclipai/adapter-claude-local/ui", replacement: path.resolve(workspaceRoot, "packages/adapters/claude-local/src/ui/index.ts") },
      { find: "@paperclipai/adapter-claude-local", replacement: path.resolve(workspaceRoot, "packages/adapters/claude-local/src/index.ts") },
      { find: "@paperclipai/adapter-codex-local/ui", replacement: path.resolve(workspaceRoot, "packages/adapters/codex-local/src/ui/index.ts") },
      { find: "@paperclipai/adapter-codex-local", replacement: path.resolve(workspaceRoot, "packages/adapters/codex-local/src/index.ts") },
      { find: "@paperclipai/adapter-copilot-cli/ui", replacement: path.resolve(workspaceRoot, "packages/adapters/copilot-cli/src/ui/index.ts") },
      { find: "@paperclipai/adapter-copilot-cli", replacement: path.resolve(workspaceRoot, "packages/adapters/copilot-cli/src/index.ts") },
      { find: "@paperclipai/adapter-cursor-local/ui", replacement: path.resolve(workspaceRoot, "packages/adapters/cursor-local/src/ui/index.ts") },
      { find: "@paperclipai/adapter-cursor-local", replacement: path.resolve(workspaceRoot, "packages/adapters/cursor-local/src/index.ts") },
      { find: "@paperclipai/adapter-openclaw-gateway/ui", replacement: path.resolve(workspaceRoot, "packages/adapters/openclaw-gateway/src/ui/index.ts") },
      { find: "@paperclipai/adapter-openclaw-gateway", replacement: path.resolve(workspaceRoot, "packages/adapters/openclaw-gateway/src/index.ts") },
      { find: "@paperclipai/adapter-opencode-local/ui", replacement: path.resolve(workspaceRoot, "packages/adapters/opencode-local/src/ui/index.ts") },
      { find: "@paperclipai/adapter-opencode-local", replacement: path.resolve(workspaceRoot, "packages/adapters/opencode-local/src/index.ts") },
      { find: "@paperclipai/adapter-pi-local/ui", replacement: path.resolve(workspaceRoot, "packages/adapters/pi-local/src/ui/index.ts") },
      { find: "@paperclipai/adapter-pi-local", replacement: path.resolve(workspaceRoot, "packages/adapters/pi-local/src/index.ts") },
      { find: "@paperclipai/adapter-utils", replacement: path.resolve(workspaceRoot, "packages/adapter-utils/src/index.ts") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3100",
        ws: true,
      },
    },
  },
});
