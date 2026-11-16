import react from "@vitejs/plugin-react";
import type { IncomingMessage } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Make DATABASE_URL from .env.local visible to the api/ handlers in dev.
  const env = loadEnv(mode, process.cwd(), "");
  process.env.DATABASE_URL ??= env.DATABASE_URL;

  return {
    plugins: [react(), apiDevServer()],
  };
});

/**
 * Dev only: serves /api/<name> from api/<name>.ts, the same file-based routing Vercel uses in
 * production, so `npm run dev` runs the UI and the functions together without a Vercel login.
 * Each file exports Web-standard handlers named after the HTTP method: GET(request) => Response.
 */
function apiDevServer(): Plugin {
  return {
    name: "api-dev-server",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
        const route = /^\/api\/([\w-]+)$/.exec(url.pathname);
        if (!route) return next();

        try {
          const module = await server.ssrLoadModule(`/api/${route[1]}.ts`);
          const method = req.method ?? "GET";
          const handler = module[method] as ((request: Request) => Promise<Response>) | undefined;
          if (typeof handler !== "function") {
            res.statusCode = 405;
            return res.end(JSON.stringify({ error: `${method} not allowed` }));
          }

          const headers = new Headers();
          for (const [name, value] of Object.entries(req.headers)) {
            if (typeof value === "string") headers.set(name, value);
          }
          const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);
          const response = await handler(new Request(url, { method, headers, body }));

          res.statusCode = response.status;
          response.headers.forEach((value, name) => res.setHeader(name, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}
