export async function deployToVercel(projectName: string, githubOwner: string, githubRepoName: string, repoId: string | number) {
  const VERCEL_TOKEN = process.env.SITES_VERCEL_TOKEN || process.env.VERCEL_TOKEN;

  if (!VERCEL_TOKEN) {
    throw new Error("SITES_VERCEL_TOKEN (ou VERCEL_TOKEN) não configurado no .env");
  }

  // 1. Aguardar 4 segundos para o GitHub propagar internamente a criação do repo
  await new Promise(resolve => setTimeout(resolve, 4000));

  // 2. Disparar Deploy no Vercel referenciando o repositório Github
  // Isso cria o projeto automaticamente e inicia o deploy da branch main
  // Adicionamos ?skipAutoDetectionConfirmation=1 para evitar erro em projetos HTML puros (sem framework fixo)
  const deployRes = await fetch("https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-"), // sanitização para URL válida
      target: "production",
      gitSource: {
        type: "github",
        repo: `${githubOwner}/${githubRepoName}`,
        repoId: repoId,
        ref: "main"
      }
    })
  });

  if (!deployRes.ok) {
    const errText = await deployRes.text();
    throw new Error(`Falha ao disparar deploy na Vercel: ${errText}`);
  }

  const result = await deployRes.json();
  
  const cleanName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  
  let publicUrl = `https://${cleanName}.vercel.app`; // fallback inicial limpo
  
  // 3. Aguardar o deploy finalizar (Polling) para evitar 404 e para capturar o alias (URL) real
  let isReady = false;
  let attempts = 0;
  const maxAttempts = 20; // max 40 segundos

  while (!isReady && attempts < maxAttempts) {
    try {
      const statusRes = await fetch(`https://api.vercel.com/v13/deployments/${result.id}`, {
        headers: { "Authorization": `Bearer ${VERCEL_TOKEN}` }
      });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const state = statusData.readyState;
        
        if (state === "READY" || state === "ERROR" || state === "CANCELED") {
          isReady = true;
          
          if (state === "READY") {
            // O deploy foi concluído com sucesso!
            // Buscaremos a URL de produção pública oficial do Vercel de forma dinâmica.
            let foundUrl = "";

            // 1. Tentar ler os domínios configurados no projeto pela API da Vercel
            const pId = result.projectId || result.project?.id || statusData.projectId || statusData.project?.id || cleanName;
            try {
              const domainsRes = await fetch(`https://api.vercel.com/v9/projects/${pId}/domains`, {
                headers: { "Authorization": `Bearer ${VERCEL_TOKEN}` }
              });
              if (domainsRes.ok) {
                const domainsData = await domainsRes.json();
                if (domainsData.domains && Array.isArray(domainsData.domains)) {
                  const projectDomains = domainsData.domains.map((d: any) => d.name);
                  const valid = projectDomains.filter((d: string) => 
                    !d.includes("-git-") && 
                    !d.includes("-projects.vercel.app")
                  );
                  if (valid.length > 0) {
                    foundUrl = `https://${valid[0]}`;
                  }
                }
              }
            } catch (err) {
              console.error("[Vercel Client] Erro ao buscar domínios do projeto na Vercel:", err);
            }

            // 2. Tentar ler os aliases atribuídos ao próprio deploy
            if (!foundUrl && statusData.alias && Array.isArray(statusData.alias)) {
              const valid = statusData.alias.filter((d: string) => 
                !d.includes("-git-") && 
                !d.includes("-projects.vercel.app")
              );
              if (valid.length > 0) {
                foundUrl = `https://${valid[0]}`;
              }
            }

            // 3. Fallback: usar a URL direta do próprio deploy
            if (!foundUrl && result.url) {
              foundUrl = `https://${result.url}`;
            }

            // 4. Fallback teórico se tudo mais falhar
            if (!foundUrl) {
              foundUrl = `https://${cleanName}.vercel.app`;
            }

            publicUrl = foundUrl;
          } else {
            console.warn(`Deploy finalizado com status de erro ou cancelado: ${state}`);
          }
        }
      }
    } catch (e) {
      // Ignora erros de rede no polling
    }
    
    if (!isReady) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;
    }
  }

  // Retornamos logo a URL exata gerada
  return {
    deployId: result.id,
    url: publicUrl
  };
}

export async function deleteFromVercel(projectName: string) {
  const VERCEL_TOKEN = process.env.SITES_VERCEL_TOKEN || process.env.VERCEL_TOKEN;

  if (!VERCEL_TOKEN) {
    throw new Error("SITES_VERCEL_TOKEN (ou VERCEL_TOKEN) não configurado no .env");
  }

  const cleanName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const deleteRes = await fetch(`https://api.vercel.com/v9/projects/${cleanName}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${VERCEL_TOKEN}`
    }
  });

  if (!deleteRes.ok && deleteRes.status !== 404) {
    throw new Error(`Falha ao deletar projeto na Vercel: ${await deleteRes.text()}`);
  }
}
