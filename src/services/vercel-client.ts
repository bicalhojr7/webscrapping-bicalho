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
  
  // O array `alias` contém os domínios públicos de produção.
  // result.url muitas vezes é a URL do deploy específico que exige login se houver Vercel Protection ativado.
  let publicUrl = `https://${result.url}`; // fallback
  if (result.alias && result.alias.length > 0) {
    publicUrl = `https://${result.alias[0]}`;
  } else {
    // Caso não retorne alias, tenta o domínio padrão principal:
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
