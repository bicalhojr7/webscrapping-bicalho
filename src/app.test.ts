import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

describe("app", () => {
  const appPromise = buildApp();

  beforeAll(async () => {
    const app = await appPromise;
    await app.ready();
  });

  afterAll(async () => {
    const app = await appPromise;
    await app.close();
  });

  it("returns health status", async () => {
    const app = await appPromise;
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("serves the local frontend", async () => {
    const app = await appPromise;
    const response = await app.inject({
      method: "GET",
      url: "/"
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("Painel de Leads");
  });

  it("rejects invalid lead searches", async () => {
    const app = await appPromise;
    const response = await app.inject({
      method: "POST",
      url: "/api/leads/search",
      payload: {
        query: ""
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      message: "Validation failed"
    });
  });
});
