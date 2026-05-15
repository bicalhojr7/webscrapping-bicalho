import { readFile } from "node:fs/promises";
import path from "node:path";

import type { FastifyInstance } from "fastify";

import { env } from "../config/env.js";

const publicDir = path.resolve(process.cwd(), "public");

const staticFiles = new Map<string, { fileName: string; contentType: string }>([
  ["/", { fileName: "index.html", contentType: "text/html; charset=utf-8" }],
  ["/assets/app.js", { fileName: "app.js", contentType: "application/javascript; charset=utf-8" }],
  ["/assets/styles.css", { fileName: "styles.css", contentType: "text/css; charset=utf-8" }]
]);

export async function registerWebRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/config", async (_request, reply) => {
    return {
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || env.SUPABASE_KEY
    };
  });
  for (const [routePath, file] of staticFiles.entries()) {
    app.get(routePath, async (_request, reply) => {
      const content = await readFile(path.join(publicDir, file.fileName), "utf8");

      reply.type(file.contentType);
      return content;
    });
  }
}
