export async function createAndPushToGithub(repoName: string, htmlContent: string) {
  const GITHUB_TOKEN = process.env.SITES_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  
  if (!GITHUB_TOKEN) {
    throw new Error("SITES_GITHUB_TOKEN (ou GITHUB_TOKEN) não configurado no .env");
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
  });
  if (!userRes.ok) throw new Error("Acesso negado ao GitHub com o token fornecido");
  
  const user = await userRes.json();
  const owner = user.login;

  // 1. Criar novo repositório
  const createRepoRes = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: repoName,
      description: "Auto-generated site by Bicalho Ads Lab / Stitch",
      private: false,
      auto_init: true
    })
  });

  let repoId: number | null = null;
  if (createRepoRes.ok) {
    const data = await createRepoRes.json();
    repoId = data.id;
  }

  if (!createRepoRes.ok && createRepoRes.status !== 422) {
    // 422 pode significar que o repo já existe. Se não for esse o erro, throw:
    throw new Error(`Erro ao criar repositório: ${await createRepoRes.text()}`);
  }

  // Se já existia, temos que buscar o ID pra mandar pro Vercel
  if (createRepoRes.status === 422) {
    const existingRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
      headers: { "Authorization": `Bearer ${GITHUB_TOKEN}` }
    });
    if (existingRes.ok) {
      const existingData = await existingRes.json();
      repoId = existingData.id;
    }
  }

  // 2. Fazer push do arquivo index.html no repositório criado
  // Primeiro tentamos buscar o arquivo para pegar o SHA caso ele já exista
  let fileSha: string | undefined = undefined;
  try {
    const getFileRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/index.html`, {
      headers: { "Authorization": `Bearer ${GITHUB_TOKEN}` }
    });
    if (getFileRes.ok) {
      const fileData = await getFileRes.json();
      fileSha = fileData.sha;
    }
  } catch (e) {}

  const bodyData: any = {
    message: "feat: stitch generated website upload",
    content: Buffer.from(htmlContent).toString("base64")
  };
  if (fileSha) bodyData.sha = fileSha;

  const pushRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/index.html`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(bodyData)
  });

  if (!pushRes.ok) {
    const errorText = await pushRes.text();
    // Se der erro de conflito (HTML já existe), apenas ignora e devolve o nome do repo
    if (!errorText.includes("Invalid request")) {
      console.warn("Possível erro ou re-criação do arquivo index.html:", errorText);
    }
  }

  if (!repoId) throw new Error("Falha ao recuperar o repoId do Github.");

  return { 
    owner, 
    repoName,
    repoId,
    githubUrl: `https://github.com/${owner}/${repoName}` 
  };
}

export async function deleteGithubRepo(repoName: string) {
  const GITHUB_TOKEN = process.env.SITES_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  
  if (!GITHUB_TOKEN) {
    throw new Error("SITES_GITHUB_TOKEN (ou GITHUB_TOKEN) não configurado no .env");
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
  });
  if (!userRes.ok) throw new Error("Acesso negado ao GitHub com o token fornecido");
  
  const user = await userRes.json();
  const owner = user.login;

  const deleteRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json"
    }
  });

  if (!deleteRes.ok && deleteRes.status !== 404) {
    throw new Error(`Erro ao deletar do Github: ${await deleteRes.text()}`);
  }
}
