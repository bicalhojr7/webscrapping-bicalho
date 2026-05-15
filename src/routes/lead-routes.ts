import { z } from "zod";
import type { FastifyInstance } from "fastify";

import { leadStatuses } from "../domain/lead.js";
import { GooglePlacesClient } from "../services/google-places-client.js";
import { buildLeadXlsx } from "../services/lead-export.js";
import { LeadQueueRepository } from "../services/lead-queue-repository.js";
import { generateSite } from "../services/stitch-client.js";
import { createAndPushToGithub, deleteGithubRepo } from "../services/github-client.js";
import { deployToVercel, deleteFromVercel } from "../services/vercel-client.js";
import { buildAutoPrompt, detectBusinessSector } from "../services/auto-generate-service.js";
import { sendWhatsAppText, isEvolutionConfigured, normalizePhoneNumber } from "../services/evolution-client.js";
import { supabase } from "../config/supabase.js";

const searchBodySchema = z.object({
  query: z.string().trim().min(2).max(120),
  regionCode: z.string().trim().length(2).optional(),
  maxResults: z.coerce.number().int().min(1).max(100).default(100),
  persist: z.boolean().default(true)
});

const listQuerySchema = z.object({
  status: z.enum(leadStatuses).optional()
});

const paramsSchema = z.object({
  id: z.string().trim().min(1)
});

const updateBodySchema = z.object({
  status: z.enum(leadStatuses)
});

const exportQuerySchema = z.object({
  status: z.enum(leadStatuses).optional()
});

export async function registerLeadRoutes(app: FastifyInstance): Promise<void> {
  const placesClient = new GooglePlacesClient();
  const repository = new LeadQueueRepository();

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/api/leads/search", async (request, reply) => {
    const input = searchBodySchema.parse(request.body);
    const searchInput = {
      query: input.query,
      maxResults: input.maxResults
    };

    const leads = await placesClient.searchLeads(
      input.regionCode
        ? { ...searchInput, regionCode: input.regionCode.toUpperCase() }
        : searchInput
    );

    // Filter out duplicates that already exist in Supabase
    const placeIds = leads.map(l => l.placeId);
    let newLeads = leads;
    
    if (placeIds.length > 0) {
      const { data: existingLeads, error } = await supabase
        .from("leads")
        .select("place_id")
        .in("place_id", placeIds);
        
      if (!error && existingLeads && existingLeads.length > 0) {
        const existingIds = new Set(existingLeads.map(l => l.place_id));
        newLeads = leads.filter(l => !existingIds.has(l.placeId));
      }
    }

    if (!input.persist) {
      return {
        saved: false,
        total: newLeads.length,
        leads: newLeads
      };
    }

    const savedLeads = await repository.saveMany(newLeads);

    reply.code(201);
    return {
      saved: true,
      total: newLeads.length,
      leads: savedLeads
    };
  });

  app.get("/api/leads", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const leads = await repository.list(query.status);

    return {
      total: leads.length,
      leads
    };
  });

  app.patch("/api/leads/:id/status", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const body = updateBodySchema.parse(request.body);
    const updated = await repository.updateStatus(id, body.status);

    if (!updated) {
      reply.code(404);
      return {
        message: "Lead not found"
      };
    }

    return {
      lead: updated
    };
  });

  app.get("/api/leads/export.xlsx", async (request, reply) => {
    const query = exportQuerySchema.parse(request.query);
    const leads = await repository.list(query.status);
    const excelBuffer = buildLeadXlsx(leads);

    reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename="prospeccao_leads.xlsx"`);

    return reply.send(excelBuffer);
  });

  app.delete("/api/leads", async (request, reply) => {
    await repository.clear();
    reply.code(200);
    return {
      message: "Fila esvaziada com sucesso"
    };
  });

  app.post("/api/leads/:id/generate-site", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const parts = request.parts();
    const buffers: Buffer[] = [];

    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "files") {
        const fileBuffer = await part.toBuffer();
        if (fileBuffer.length > 0) {
           buffers.push(fileBuffer);
        }
      }
    }

    if (buffers.length === 0) {
      reply.code(400);
      return { message: "Você precisa enviar ao menos 1 imagem de referência." };
    }

    // Buscamos o Lead pelo ID para pegar os dados e injetar na geração
    const leadsList = await repository.list();
    const targetLead = leadsList.find(l => l.id === id);

    const businessContext = `
DADOS OBRIGATÓRIOS DO NEGÓCIO (USE ESTES DADOS PARA CRIAR A COPY DO SITE, SUBSTITUINDO QUALQUER EXEMPLO):
- Nome Oficial do Negócio: ${targetLead?.companyName || "Empresa Especializada"}
- Especialidade: Deduzida a partir do nome e das imagens.
- Meta de Conversão: Fazer o cliente entrar em contato para agendar ou pedir orçamento.
- Tom de Voz da Copy: Altamente profissional, persuasivo, autoridade, luxo/premium.
    `.trim();

    // Call stitched AI
    let stitchResult: { html: string; stitchProjectId: string; stitchSessionId: string };
    try {
      stitchResult = await generateSite(buffers, businessContext);
    } catch (error) {
      request.log.error({ err: error }, "Erro na geração do site pelo Stitch");
      reply.code(500);
      return { message: "Falha ao gerar código via Stitch AI." };
    }

    const generatedCode = stitchResult.html;

    
    // Sanitização profunda: Removemos tudo que não for Alfanumérico e convertemos pra minúsculo
    const rawProjectName = targetLead ? targetLead.companyName : id;
    const sanitizedProjectName = rawProjectName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/[^a-z0-9-]/g, "-")     // troca espaços/especiais por hífen
      .replace(/-+/g, "-")             // remove hífens duplos
      .replace(/^-|-$/g, "");          // remove hífen do começo ou fim

    // Connect to versioning and deploy usa o sanitizado
    try {
      const gData = await createAndPushToGithub(sanitizedProjectName, generatedCode);
      const outputDeploy = await deployToVercel(sanitizedProjectName, gData.owner, gData.repoName, gData.repoId);

      // Save the links to our DB
      await repository.saveSiteData(id, {
        siteUrl: outputDeploy.url,
        githubUrl: gData.githubUrl,
        stitchProjectId: stitchResult.stitchProjectId,
        stitchSessionId: stitchResult.stitchSessionId
      });

      return {
        success: true,
        deployUrl: outputDeploy.url,
        githubUrl: gData.githubUrl
      };
    } catch (error) {
       console.error("Erro no fluxo Github/Vercel detalhado:", error);
       request.log.error({ err: error }, "Erro no fluxo Github/Vercel");
       reply.code(500);
       return { message: "Site gerado ("+id+"), mas ocorreu erro no deploy." };
    }
  });

  // ROTA MÁGICA: EDITA RE-USANDO O HISTÓRICO DO SITE NA API (ECONOMIZA TOKEN E TEMPO)
  app.post("/api/leads/:id/edit-site", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const bodyArgs = request.body as any;
    const prompt = bodyArgs.prompt;

    if (!prompt) {
      reply.code(400);
      return { message: "Prompt não fornecido para edição." };
    }

    const leadsList = await repository.list();
    const targetLead = leadsList.find(l => l.id === id);

    if (!targetLead || !targetLead.stitchSessionId || !targetLead.stitchProjectId) {
      reply.code(404);
      return { message: "Site anterior não encontrado para esta lead (Gere o site primeiro)." };
    }

    let editResult;
    try {
       const { editSite } = await import('../services/stitch-client.js');
       editResult = await editSite(targetLead.stitchProjectId, targetLead.stitchSessionId, prompt);
    } catch (e) {
       request.log.error({ err: e }, "Erro ao editar o site no Stitch");
       reply.code(500);
       return { message: "Falha ao editar e regenerar com Stitch AI." };
    }

    const generatedCode = editResult.html;

    const rawProjectName = targetLead.companyName;
    const sanitizedProjectName = rawProjectName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    
    let githubRepoUrl = "";
    try {
      // Nosso client de Github já está esmagando o index.html antigo perfeitamente!
      const gData = await createAndPushToGithub(sanitizedProjectName, generatedCode);
      githubRepoUrl = gData.githubUrl;
    } catch (e) {
      request.log.error({ err: e }, "Erro ao atualizar o Github na Edição");
      reply.code(500);
      return { message: "Falha ao enviar edição para o Github." };
    }

    return {
      success: true,
      message: "Edição aplicada! O site na Vercel recarregará sozinho em alguns segundos.",
      githubUrl: githubRepoUrl,
      deployUrl: targetLead.siteUrl 
    };
  });

  // ROTA PARA PUBLICAR HTML MANUAL (GERADO NO STITCH MANUAMENTE)
  app.post("/api/leads/:id/publish-manual", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const bodyArgs = request.body as any;
    const html = bodyArgs.html;

    if (!html) {
      reply.code(400);
      return { message: "Nenhum HTML fornecido." };
    }

    const leadsList = await repository.list();
    const targetLead = leadsList.find(l => l.id === id);

    if (!targetLead) {
      reply.code(404);
      return { message: "Lead não encontrado." };
    }

    const rawProjectName = targetLead.companyName;
    const sanitizedProjectName = rawProjectName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    
    try {
      // Create/Update Github Repo
      const gData = await createAndPushToGithub(sanitizedProjectName, html);
      
      // Deploy to Vercel
      const outputDeploy = await deployToVercel(sanitizedProjectName, gData.owner, gData.repoName, gData.repoId);

      // Save to persistence
      await repository.saveSiteData(id, {
        siteUrl: outputDeploy.url,
        githubUrl: gData.githubUrl,
        // Since it's manual, we don't have stitch project IDs. Keep existing or pass undefined
        stitchProjectId: targetLead.stitchProjectId || "",
        stitchSessionId: targetLead.stitchSessionId || "" // Mantemos vazios se não houver
      });

      return {
        success: true,
        deployUrl: outputDeploy.url,
        githubUrl: gData.githubUrl
      };
    } catch (e) {
      request.log.error({ err: e }, "Erro no fluxo manual Github/Vercel");
      reply.code(500);
      return { message: "Falha ao publicar site manual." };
    }
  });

  // ROTA PARA APAGAR SITE (GITHUB + VERCEL)
  app.delete("/api/leads/:id/site", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    
    const leadsList = await repository.list();
    const targetLead = leadsList.find(l => l.id === id);

    if (!targetLead) {
      reply.code(404);
      return { message: "Lead não encontrado." };
    }

    if (!targetLead.siteUrl && !targetLead.githubUrl) {
      reply.code(400);
      return { message: "Lead não possui site gerado para excluir." };
    }

    const rawProjectName = targetLead.companyName;
    const sanitizedProjectName = rawProjectName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    try {
      // 1. Deleta do Github
      await deleteGithubRepo(sanitizedProjectName);
    } catch (e) {
      request.log.error({ err: e }, "Erro ao deletar do Github (ignorado)");
      // Continua pra Vercel mesmo se o github der pau
    }

    try {
      // 2. Deleta da Vercel
      await deleteFromVercel(sanitizedProjectName);
    } catch (e) {
      request.log.error({ err: e }, "Erro ao deletar da Vercel (ignorado)");
    }

    // 3. Atualiza banco limpando as credenciais de site
    try {
       await repository.saveSiteData(id, {
        siteUrl: undefined,
        githubUrl: undefined,
        stitchProjectId: undefined,
        stitchSessionId: undefined
      });
    } catch (e) {
      request.log.error({ err: e }, "Erro ao limpar banco");
    }

    return { success: true, message: "Site e Repositório apagados com sucesso!" };
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ROTA: MODO AUTOMÁTICO — gera sites em massa (máx 10) via SSE
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/leads/auto-generate", async (request, reply) => {
    const MAX_BATCH = 10;

    // A imagem customizada foi removida do fluxo em lote.
    const hasCustomImage = false;
    const imageBuffers: Buffer[] = [];

    // Carrega fila e filtra sem site (sem websiteUri válido e sem site já gerado)
    const allLeads = await repository.list();
    // Somente leads APROVADOS que ainda não têm site gerado entram no funil automático
    const noSiteLeads = allLeads.filter((lead) => {
      if (lead.status !== "approved") return false; // ✅ apenas aprovados
      if (lead.siteUrl) return false;               // já tem site — pula
      return true;
    });

    const batch = noSiteLeads.slice(0, MAX_BATCH);

    // Configura SSE
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });

    const sendEvent = (event: string, data: object) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent("start", {
      total: batch.length,
      hasCustomImage,
      message: `Iniciando geração para ${batch.length} empresa(s) aprovada(s) sem site.`
    });

    let successCount = 0;
    let failCount = 0;
    let waSentCount = 0;
    
    let isDisconnected = false;
    request.raw.on("close", () => {
      isDisconnected = true;
    });

    for (let i = 0; i < batch.length; i++) {
      if (isDisconnected) {
        request.log.info("Client disconnected. Aborting auto-generate loop.");
        break;
      }

      const lead = batch[i];
      if (!lead) continue; // type guard — never undefined em batch[i], mas garante TS

      const sector = detectBusinessSector(lead.companyName, lead.businessType);

      sendEvent("progress", {
        index: i + 1,
        total: batch.length,
        leadId: lead.id,
        companyName: lead.companyName,
        sector,
        status: "generating",
        message: `Gerando (${i + 1}/${batch.length}): ${lead.companyName}`
      });

      try {
        // Monta prompt personalizado pelo setor
        const autoPrompt = buildAutoPrompt(lead, hasCustomImage);

        // Gera o site via Stitch
        const stitchResult = await generateSite(imageBuffers, autoPrompt);

        // Sanitiza nome do projeto
        const sanitizedName = lead.companyName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");

        // Deploy GitHub + Vercel
        const gData = await createAndPushToGithub(sanitizedName, stitchResult.html);
        const deploy = await deployToVercel(sanitizedName, gData.owner, gData.repoName, gData.repoId);

        // Persiste dados do site no lead
        await repository.saveSiteData(lead.id, {
          siteUrl: deploy.url,
          githubUrl: gData.githubUrl,
          stitchProjectId: stitchResult.stitchProjectId,
          stitchSessionId: stitchResult.stitchSessionId
        });

        successCount++;

        // Envio automático via Evo (se configurada) — falha não interrompe o fluxo
        let waSent = false;
        let waError = "";
        if (isEvolutionConfigured()) {
          try {
            const waMsg = [
              `Fala ${lead.companyName}, tudo bem?`,
              ``,
              `VOCÊ GANHOU UMA PRÉVIA DO SEU SITE GRÁTIS 🎁`,
              ``,
              `Eu tava dando uma olhada aqui nas empresas da região e vi que o trabalho de vocês é muito bom, mas o posicionamento atual na internet não reflete o valor do serviço.`,
              ``,
              `Como a gente trabalha com design de alta conversão, tomei a liberdade de construir o visual de como ficaria um site Premium de vocês focado em trazer contatos pro WhatsApp.`,
              ``,
              `Dá uma olhada em como ficou:`,
              deploy.url
            ].join("\n");

            await sendWhatsAppText({ number: lead.phoneNumber, text: waMsg, delayMs: 1500 });
            waSent = true;
            waSentCount++;
          } catch (waErr: any) {
            waError = waErr?.message ?? "erro desconhecido";
            request.log.warn({ err: waErr }, `[Evo] Falha ao enviar WhatsApp para ${lead.companyName}`);
          }
        }

        sendEvent("done", {
          index: i + 1,
          total: batch.length,
          leadId: lead.id,
          companyName: lead.companyName,
          sector,
          status: "success",
          deployUrl: deploy.url,
          githubUrl: gData.githubUrl,
          waSent,
          waError: waError || undefined,
          message: `✅ Site publicado: ${lead.companyName}${waSent ? " | 📲 WhatsApp enviado" : isEvolutionConfigured() ? ` | ⚠️ WhatsApp falhou` : ""}`
        });
      } catch (err: any) {
        failCount++;
        request.log.error({ err }, `Erro na geração automática para: ${lead.companyName}`);

        sendEvent("done", {
          index: i + 1,
          total: batch.length,
          leadId: lead.id,
          companyName: lead.companyName,
          sector,
          status: "error",
          message: `❌ Falha: ${lead.companyName} — ${err?.message ?? "erro desconhecido"}`
        });
      }
    }

    sendEvent("complete", {
      total: batch.length,
      success: successCount,
      failed: failCount,
      waSent: waSentCount,
      message: `Sessão concluída. ${successCount} site(s) gerado(s)${waSentCount > 0 ? `, ${waSentCount} WhatsApp(s) enviado(s)` : ""}${failCount > 0 ? `, ${failCount} falha(s)` : ""}.`
    });

    reply.raw.end();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ROTA: Envia mensagem WhatsApp via Evolution API
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/leads/:id/send-whatsapp", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const body = request.body as { customMessage?: string; useCustomMessage?: boolean };

    if (!isEvolutionConfigured()) {
      reply.code(503);
      return {
        message:
          "Evolution API não configurada. Adicione EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE no .env"
      };
    }

    const leadsList = await repository.list();
    const lead = leadsList.find((l) => l.id === id);

    if (!lead) {
      reply.code(404);
      return { message: "Lead não encontrado." };
    }

    if (!lead.phoneNumber) {
      reply.code(400);
      return { message: "Lead sem número de telefone." };
    }

    // Monta a mensagem final (customizada ou padrão Passo 1)
    let messageText: string;

    if (body.useCustomMessage && body.customMessage?.trim()) {
      messageText = body.customMessage.trim();
    } else {
      const siteLink = lead.siteUrl ?? "[Site sendo preparado]";
      messageText = [
        `Fala ${lead.companyName}, tudo bem?`,
        ``,
        `VOCÊ GANHOU UMA PRÉVIA DO SEU SITE GRÁTIS 🎁`,
        ``,
        `Eu tava dando uma olhada aqui nas empresas da região e vi que o trabalho de vocês é muito bom, mas o posicionamento atual na internet não reflete o valor do serviço.`,
        ``,
        `Como a gente trabalha com design de alta conversão, tomei a liberdade de construir o visual de como ficaria um site Premium de vocês focado em trazer contatos pro WhatsApp.`,
        ``,
        `Dá uma olhada em como ficou:`,
        siteLink
      ].join("\n");
    }

    try {
      const result = await sendWhatsAppText({
        number: lead.phoneNumber,
        text: messageText,
        delayMs: 1500
      });

      request.log.info({ leadId: id, messageId: result.messageId }, "WhatsApp enviado via Evo");

      return {
        success: true,
        messageId: result.messageId,
        status: result.status,
        number: result.number,
        previewText: messageText.slice(0, 120) + (messageText.length > 120 ? "..." : "")
      };
    } catch (err: any) {
      request.log.error({ err }, "Erro ao enviar WhatsApp via Evo");
      reply.code(500);
      return { message: `Falha ao enviar: ${err?.message ?? "erro desconhecido"}` };
    }
  });

  // ROTA: Verifica se Evolution API está configurada
  app.get("/api/evolution/status", async () => {
    const configured = isEvolutionConfigured();
    return {
      configured,
      message: configured
        ? "Evolution API configurada e pronta."
        : "Evolution API não configurada. Verifique o .env"
    };
  });

}
