import "dotenv/config";

async function run() {
  const token = process.env.VERCEL_TOKEN || process.env.SITES_VERCEL_TOKEN;
  const res = await fetch("https://api.vercel.com/v6/deployments?limit=1", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const latestDeploy = data.deployments[0];
  console.log("Latest deploy ID:", latestDeploy.uid);
  
  const statusRes = await fetch(`https://api.vercel.com/v13/deployments/${latestDeploy.uid}`, {
      headers: { "Authorization": `Bearer ${token}` }
  });
  const statusData = await statusRes.json();
  console.log("Deployment state:", statusData.readyState);
}

run();
