import "dotenv/config";

async function run() {
  const token = process.env.VERCEL_TOKEN || process.env.SITES_VERCEL_TOKEN;
  const res = await fetch("https://api.vercel.com/v6/deployments?limit=1", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const latestDeploy = data.deployments[0];
  const projectName = latestDeploy.name;

  console.log("Project Name:", projectName);
  
  // Get deployment aliases
  const statusRes = await fetch(`https://api.vercel.com/v13/deployments/${latestDeploy.uid}`, {
      headers: { "Authorization": `Bearer ${token}` }
  });
  const statusData = await statusRes.json();
  console.log("Deployment alias:", statusData.alias);
  
  // Get project aliases
  const projectRes = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
      headers: { "Authorization": `Bearer ${token}` }
  });
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
