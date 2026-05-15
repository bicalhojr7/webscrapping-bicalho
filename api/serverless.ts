import * as dotenv from "dotenv";
dotenv.config();

import { buildApp } from "../src/app.js";

let app: any;

export default async function handler(req: any, res: any) {
  if (!app) {
    app = await buildApp();
  }
  
  await app.ready();
  app.server.emit("request", req, res);
}
