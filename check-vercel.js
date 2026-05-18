import "dotenv/config";
import fetch from "node-fetch";

async function run() {
  const token = process.env.VERCEL_TOKEN || process.env.SITES_VERCEL_TOKEN;
  const res = await fetch("https://api.vercel.com/v6/deployments?limit=5", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(JSON.stringify(data.deployments.map(d => ({
    name: d.name,
    state: d.state,
    url: d.url,
    created: new Date(d.created).toISOString(),
    error: d.error
  })), null, 2));
}

run();
