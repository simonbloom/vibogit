import { createServer } from "./server";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 9111;

console.log(`[ViboGit Daemon] Starting on port ${PORT}...`);

const server = createServer(PORT);

console.log(`[ViboGit Daemon] WebSocket server running at ws://localhost:${PORT}`);

process.on("SIGINT", () => {
  console.log("\n[ViboGit Daemon] Shutting down...");
  server.stop();
  process.exit(0);
});
