import "dotenv/config";

async function run() {
  const token = process.env.VERCEL_TOKEN || process.env.SITES_VERCEL_TOKEN;
  const res = await fetch("https://api.vercel.com/v9/projects", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const projects = data.projects.filter(p => p.name.includes("mk-fitness"));
  for (const p of projects) {
    console.log("Project:", p.name);
    console.log("Targets:", p.targets?.production?.alias);
  }
}

run();
