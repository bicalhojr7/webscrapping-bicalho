import "dotenv/config";
import { generateSite } from "./src/services/stitch-client.js";

async function main() {
  console.log("Testing generateSite...");
  
  // Create a tiny 1x1 transparent PNG to pass as an image buffer
  const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

  try {
    const result = await generateSite([tinyPng], "Crie um site de advocacia");
    console.log("Success! HTML length:", result.html.length);
  } catch (error) {
    console.error("Failed:", error);
  }
}

main();
