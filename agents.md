# ViboGit Agent Configuration

## Package Manager
- Use `bun` for all package management and running scripts
- Use `bun install` instead of `npm install` or `pnpm install`
- Use `bun run <script>` instead of `npm run` or `pnpm run`
- Use `bun add <package>` to add dependencies

## Development
- Dev server port: 3002
- Run dev: `bun run dev`
- Build: `bun run build`
- Typecheck: `bun run typecheck`

## Monorepo Structure
- `/apps/web` - Next.js 15 web application
- `/apps/daemon` - Bun-based local daemon (WebSocket server on port 9111)
- `/packages/shared` - Shared TypeScript types


