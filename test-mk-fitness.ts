import "dotenv/config";

async function run() {
  const token = process.env.VERCEL_TOKEN || process.env.SITES_VERCEL_TOKEN;
  const projectName = "mk-fitness-studio-treinamento-personalizado-chijs";
  const projectRes = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
      headers: { "Authorization": `Bearer ${token}` }
  });
  if (!projectRes.ok) {
    console.error("Project not found:", await projectRes.text());
    return;
  }
  const projectData = await projectRes.json();
  let allAliases = [];
  if (projectData.targets?.production?.alias) {
    allAliases.push(...projectData.targets.production.alias);
  }
  if (projectData.alias) {
    allAliases.push(...projectData.alias.map((a: any) => a.domain));
  }
  console.log("Project aliases:", allAliases);
}

run();
