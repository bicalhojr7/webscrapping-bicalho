import Fastify from "fastify";
import { ZodError } from "zod";
import multipart from "@fastify/multipart";

import { registerLeadRoutes } from "./routes/lead-routes.js";
import { registerWebRoutes } from "./routes/web-routes.js";
import { registerCronRoutes } from "./routes/cron-routes.js";
import { supabase } from "./config/supabase.js";

export async function buildApp() {
  const app = Fastify({
    logger: true
  });

  await app.register(multipart, {
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit (up to 3 images)
  });

  // Authentication Middleware
  app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith("/api/leads")) {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        reply.code(401).send({ message: "Unauthorized. Please log in." });
        return;
      }
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await supabase.auth.getUser(token);
      
      if (error || !data.user) {
        reply.code(401).send({ message: "Invalid or expired token." });
        return;
      }
      
      // Inject user info into request if needed later
      (request as any).user = data.user;
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      reply.code(400).send({
        message: "Validation failed",
        issues: error.issues
      });
      return;
    }

    if (error instanceof Error && error.message.includes("GOOGLE_PLACES_API_KEY")) {
      reply.code(500).send({
        message: error.message
      });
      return;
    }

    reply.send(error);
  });

  await registerLeadRoutes(app);
  await registerWebRoutes(app);
  await registerCronRoutes(app);
  return app;
}
