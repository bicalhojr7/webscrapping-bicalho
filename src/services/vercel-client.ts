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
  
  let publicUrl = `https://${result.url}`; // fallback para a url de deploy (que tem senha)

  try {
    // Busca os detalhes do projeto recém-criado para pegar o domínio limpo de produção (que é aberto ao público)
    const projectRes = await fetch(`https://api.vercel.com/v9/projects/${cleanName}`, {
      headers: { "Authorization": `Bearer ${VERCEL_TOKEN}` }
    });
    if (projectRes.ok) {
      const projectData = await projectRes.json();
      if (projectData.targets?.production?.alias?.[0]) {
        publicUrl = `https://${projectData.targets.production.alias[0]}`;
      } else if (projectData.alias && projectData.alias.length > 0) {
        publicUrl = `https://${projectData.alias[0].domain}`;
      } else {
        publicUrl = `https://${cleanName}.vercel.app`;
      }
    } else {
      publicUrl = `https://${cleanName}.vercel.app`;
    }
  } catch (e) {
    console.error("Erro ao buscar detalhes do projeto Vercel:", e);
    publicUrl = `https://${cleanName}.vercel.app`;
  }
  
  // Retornamos logo a URL gerada (ficará acessível em breve).
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
