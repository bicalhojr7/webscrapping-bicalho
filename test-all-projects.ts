import "dotenv/config";

async function run() {
  const token = process.env.VERCEL_TOKEN || process.env.SITES_VERCEL_TOKEN;
  const res = await fetch("https://api.vercel.com/v9/projects", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  for (const p of data.projects) {
    console.log("Project:", p.name);
    let allAliases = [];
    if (p.targets?.production?.alias) {
      allAliases.push(...p.targets.production.alias);
    }
    if (p.alias) {
      allAliases.push(...p.alias.map((a: any) => a.domain));
    }
    console.log("  Aliases:", allAliases);
  }
}

run();
