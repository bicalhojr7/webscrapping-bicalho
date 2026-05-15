import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { requireStitchApiKey } from "../config/env.js";

const STITCH_URL = "https://stitch.googleapis.com/mcp";

/**
 * Helper para executar comandos Json-RPC puros pra API do Stitch MCP
 */
async function callStitchJsonRpc(method: string, internalMethod: string, params: any) {
  const payload = {
     jsonrpc: "2.0",
     id: crypto.randomUUID(),
     method: method, // "tools/call"
     params: {
        name: internalMethod,
        arguments: params
     }
  };

  const MAX_RETRIES = 3;
  let attempt = 0;
  
  while (attempt < MAX_RETRIES) {
    try {
      const response = await fetch(STITCH_URL, {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": requireStitchApiKey(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Stitch JSON-RPC Falhou ${response.status}: ${errText}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(`Erro retornado no corpo do JSON-RPC: ${JSON.stringify(data.error)}`);
      }
      return data;
    } catch (error: any) {
      attempt++;
      const isNetworkError = error.code === 'ECONNRESET' || error.message.includes('fetch failed');
      
      console.warn(`\n[Stitch API] Aviso: Falha na chamada da API (Tentativa ${attempt}/${MAX_RETRIES}). Motivo: ${error.message}`);
      
      if (attempt >= MAX_RETRIES) {
        throw error;
      }
      
      if (isNetworkError) {
        console.log(`[Stitch API] Aguardando 5 segundos antes de tentar novamente...`);
        await new Promise(res => setTimeout(res, 5000));
      } else {
        // Se for um erro da API não tentamos de novo para não floodar
        throw error;
      }
    }
  }
}

/**
 * Envia o printscreen da página + Prompt para a API do Stitch via REST robusto, sem EventSources
 * e retorna o index.html gerado.
 */
export async function generateSite(imageBuffers: Buffer[], promptText?: string): Promise<{ html: string; stitchProjectId: string; stitchSessionId: string }> {
  const defaultPromptPath = path.resolve(process.cwd(), "data", "site-prompt.txt");
  let finalPrompt = "";
  
  try {
    const rawPrompt = await fs.readFile(defaultPromptPath, "utf-8");
    finalPrompt = promptText ? `${rawPrompt}\n\n[INSTRUÇÃO DO CLIENTE]: ${promptText}` : rawPrompt;
  } catch (error) {
    console.error("Não foi possível ler o site-prompt.txt base.");
    finalPrompt = promptText || "Gere um site premium baseado na imagem.";
  }

  finalPrompt += `\n\n[INSTRUÇÃO CRÍTICA MCP STITCH]: Atue como um Engenheiro Front-end Senior. Foi enviada ao menos 1 imagem de referência do negócio. Seu objetivo é GERAR O CÓDIGO COMPLETO (HTML + Tailwind CSS inline) de uma Landing Page ultra-premium, moderna e de altíssima conversão. O IDIOMA DEVE SER 100% PORTUGUÊS DO BRASIL (PT-BR). NENHUM TEXTO EM INGLÊS.
  
ATENÇÃO À ESCALA E LAYOUT: 
1. Use proporções elegantes e contidas. Evite fontes exageradamente gigantes (limite títulos Desktop a 4xl ou 5xl no máximo).
2. O conteúdo principal deve estar sempre dentro de containers centralizados (ex: max-w-7xl mx-auto) com espaçamentos laterais seguros (px-6 md:px-12).
3. Preste muita atenção em imagens: elas NÃO devem estourar os limites da tela cortando informação importante. Use proporções adequadas (ex: aspect-video, object-cover) com limites de largura.
4. FIDELIDADE DE CORES (MUITO IMPORTANTE): Extraia a paleta de cores ESTRITAMENTE da(s) imagem(ns) enviada(s). Se a marca na imagem for Preto e Branco, você DEVE gerar o site INTEIRO em tons de preto, branco e cinza. NUNCA adicione "cores bonitas" (como azul, vermelho ou verde) apenas para decorar, se essas cores não fizerem parte do branding original do cliente lido na foto.

OBRIGATÓRIO: NÃO crie documentações de design system ou relatórios textuais. GERE DIRETAMENTE A TELA FINAL e retorne o código HTML funcional em um único arquivo, reproduzindo a identidade visual exata contida nas imagens. O resultado deve ser o código source final.`;

  console.log("Iniciando bypass MCP - Criando Projeto na infra do Stitch...");

  const imagesBase64 = imageBuffers.map(buf => `data:image/png;base64,${buf.toString("base64")}`);
  const multipleImagesPrompt = imagesBase64.map((img, i) => `[Referência Visual ${i+1}]: \n![Ref](${img})\n`).join("\n");
  const fullPrompt = finalPrompt + "\n\n" + multipleImagesPrompt;

  try {
    // 1. Criar novo Projeto
    const projectRes = await callStitchJsonRpc("tools/call", "create_project", { title: "Bicalho Ads Lab Gen" });
    const projectData = projectRes.result?.structuredContent || JSON.parse(projectRes.result?.content?.[0]?.text || "{}");
    const rawProjectId = projectData.name || projectData.projectId;
    const finalProjectId = rawProjectId.replace("projects/", "");

    console.log(`Projeto Craido ID: ${finalProjectId}. Iniciando geração lenta (1-3 min) via texto...`);

    // 2. Acionar geração bruta (com imagens engastadas em MD)
    const generateRes = await callStitchJsonRpc("tools/call", "generate_screen_from_text", {
      projectId: finalProjectId,
      prompt: fullPrompt,
      modelId: "GEMINI_3_FLASH" // Ou Deixe vazio pro padrão
    });

    const resultTxt = generateRes.result?.content?.[0]?.text;
    if (!resultTxt) throw new Error("Retorno nulo da geração do Stitch.");

    // Tentar extrair do Json Estruturado ou do regex puro
    let htmlContent = "";
    let sessionId = "unknown";
    try {
       const parsedOut = JSON.parse(resultTxt);
       sessionId = parsedOut.sessionId || "unknown";
       const components = parsedOut.outputComponents || [];
       for (const comp of components) {
          // Procurar o htmlCode em qualquer uma das screens retornadas
          const screens = comp.design?.screens || [];
          let foundHtmlCode = null;
          for (const screen of screens) {
            if (screen.htmlCode) {
              foundHtmlCode = screen.htmlCode;
              break;
            }
          }

          if (foundHtmlCode?.downloadUrl) {
             console.log("Stitch retornou um downloadUrl, baixando HTML...", foundHtmlCode.downloadUrl);
             const downloadRes = await fetch(foundHtmlCode.downloadUrl);
             if (downloadRes.ok) {
                 htmlContent = await downloadRes.text();
             }
             break;
          } else if (foundHtmlCode?.content) {
             htmlContent = foundHtmlCode.content;
             break;
          } else if (comp.design?.htmlCode?.content) {
             htmlContent = comp.design.htmlCode.content;
             break;
          } else if (comp.renderedHtml) {
             htmlContent = comp.renderedHtml;
             break;
          } else if (comp.code?.html) {
             htmlContent = comp.code.html;
             break;
          }
       }
    } catch(e) {}

    // Fallback pra extração via Regex agressivo caso venha texto livre
    if (!htmlContent) {
      console.log(`[DEBUG STITCH] htmlContent vazio. Analisando resultTxt puro:`, resultTxt.substring(0, 500));
      
      const htmlMatch = resultTxt.match(/```html\s*([\s\S]*?)<\/html>/i) || resultTxt.match(/```html\s*([\s\S]*?)```/i);
      if (htmlMatch) {
         htmlContent = htmlMatch[1] + (htmlMatch[0].toLowerCase().includes("</html>") ? "</html>" : "");
         console.log(`[DEBUG STITCH] HTML extraído via Regex.`);
      } else {
         console.warn(`[DEBUG STITCH] Regex falhou. Tentando extrair a tag HTML diretamente do texto...`);
         const directHtmlMatch = resultTxt.match(/(<!DOCTYPE html>[\s\S]*?<\/html>|<html[\s\S]*?<\/html>)/i);
         if (directHtmlMatch) {
             htmlContent = directHtmlMatch[1];
             console.log(`[DEBUG STITCH] HTML extraído via direct HTML match.`);
         } else {
             throw new Error(`A API do Stitch não retornou um código HTML válido. Retorno: ${resultTxt.substring(0, 200)}...`);
         }
      }
    }

    // Se o conteúdo veio com sequências Unicode de escape (ex: \u003c) e literais \n (Double Escaped)
    if (htmlContent && htmlContent.includes("\\u003c")) {
       try {
         htmlContent = htmlContent
            .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
       } catch (e) {
         console.warn("Erro ao decodificar unicode literal:", e);
       }
    }

    return { html: htmlContent, stitchProjectId: finalProjectId, stitchSessionId: sessionId };
  } catch (mcpError) {
    console.warn("Falha crítica no fluxo POST (Bypass) do Stitch:", mcpError);
    throw mcpError;
  }
}

/**
 * Permite regenerar partes do site utilizando o sessionId e projectId guardados, sem perder o histórico visual.
 */
export async function editSite(projectId: string, sessionId: string, editPrompt: string): Promise<{ html: string }> {
  console.log(`Editando bypass MCP - Projeto: ${projectId}, Sessão: ${sessionId}`);

  try {
    const editRes = await callStitchJsonRpc("tools/call", "edit_screens", {
      projectId: projectId,
      sessionId: sessionId,
      prompt: editPrompt
    });

    const resultTxt = editRes.result?.content?.[0]?.text;
    if (!resultTxt) throw new Error("Retorno nulo da edição do Stitch.");

    let htmlContent = "";
    try {
       const parsedOut = JSON.parse(resultTxt);
       const components = parsedOut.outputComponents || [];
       for (const comp of components) {
          const screens = comp.design?.screens || [];
          let foundHtmlCode = null;
          for (const screen of screens) {
            if (screen.htmlCode) {
              foundHtmlCode = screen.htmlCode;
              break;
            }
          }

          if (foundHtmlCode?.downloadUrl) {
             console.log("Stitch retornou um downloadUrl (edit_screens), baixando HTML...", foundHtmlCode.downloadUrl);
             const downloadRes = await fetch(foundHtmlCode.downloadUrl);
             if (downloadRes.ok) {
                 htmlContent = await downloadRes.text();
             }
             break;
          } else if (foundHtmlCode?.content) {
             htmlContent = foundHtmlCode.content;
             break;
          } else if (comp.design?.htmlCode?.content) {
             htmlContent = comp.design.htmlCode.content;
             break;
          } else if (comp.renderedHtml) {
             htmlContent = comp.renderedHtml;
             break;
          }
       }
    } catch(e) {}

    // Fallback pra regex
    if (!htmlContent) {
      const htmlMatch = resultTxt.match(/```html\s*([\s\S]*?)<\/html>/i) || resultTxt.match(/```html\s*([\s\S]*?)```/i);
      if (htmlMatch) {
         htmlContent = htmlMatch[1] + (htmlMatch[0].toLowerCase().includes("</html>") ? "</html>" : "");
      } else {
         const directHtmlMatch = resultTxt.match(/(<!DOCTYPE html>[\s\S]*?<\/html>|<html[\s\S]*?<\/html>)/i);
         if (directHtmlMatch) {
             htmlContent = directHtmlMatch[1];
         }
      }
    }

    if (!htmlContent) {
      throw new Error("Não foi possível extrair HTML da edição.");
    }

    if (htmlContent.includes("\\u003c")) {
       try {
         htmlContent = htmlContent
            .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
       } catch (e) { }
    }

    return { html: htmlContent };
  } catch (mcpError) {
    console.error("Falha ao editar site no Stitch:", mcpError);
    throw mcpError;
  }
}
