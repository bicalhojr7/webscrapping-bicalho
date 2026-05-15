import { FastifyInstance } from "fastify";
import { supabase } from "../config/supabase.js";
import { deleteGithubRepo } from "../services/github-client.js";
import { deleteFromVercel } from "../services/vercel-client.js";

export async function registerCronRoutes(app: FastifyInstance) {
  app.get("/api/cron/cleanup-sites", async (request, reply) => {
    // Vercel sends a CRON_SECRET header to authenticate cron jobs
    const authHeader = request.headers.authorization;
    if (process.env.CRON_SECRET) {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        reply.code(401).send({ message: "Unauthorized CRON request" });
        return;
      }
    }

    try {
      // 1. Encontrar leads aprovados que têm site há mais de 7 dias
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: leadsToCleanup, error } = await supabase
        .from("leads")
        .select("id, stitch_project_id, github_url")
        .not("site_url", "is", null)
        .lt("updated_at", sevenDaysAgo.toISOString())
        .limit(10); // Limite de 10 por vez para não estourar o timeout da Vercel

      if (error) {
        throw new Error(`Erro ao buscar leads: ${error.message}`);
      }

      if (!leadsToCleanup || leadsToCleanup.length === 0) {
        return reply.send({ message: "Nenhum site antigo para limpar." });
      }

      let successCount = 0;
      let failureCount = 0;

      for (const lead of leadsToCleanup) {
        try {
          // Extrair repoName da URL do Github (ex: https://github.com/user/repo-name)
          if (lead.github_url) {
            const repoNameMatch = lead.github_url.match(/github\.com\/[^\/]+\/([^\/]+)/);
            if (repoNameMatch && repoNameMatch[1]) {
              await deleteGithubRepo(repoNameMatch[1]);
            }
          }

          if (lead.stitch_project_id) {
            await deleteFromVercel(lead.stitch_project_id);
          }

          // Limpar no banco
          await supabase
            .from("leads")
            .update({
              site_url: null,
              github_url: null,
              stitch_project_id: null,
              stitch_session_id: null,
            })
            .eq("id", lead.id);

          successCount++;
        } catch (err) {
          console.error(`Erro ao limpar o lead ${lead.id}:`, err);
          failureCount++;
        }
      }

      return reply.send({
        message: "Limpeza concluída.",
        successCount,
        failureCount,
      });
    } catch (err) {
      console.error("Erro na cron de cleanup:", err);
      reply.code(500).send({ message: "Internal server error during cleanup." });
    }
  });
}
