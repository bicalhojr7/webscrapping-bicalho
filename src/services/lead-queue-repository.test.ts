import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LeadQueueRepository } from "./lead-queue-repository.js";

describe("LeadQueueRepository", () => {
  it("deduplicates leads by place id", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "lead-queue-"));
    const repository = new LeadQueueRepository();

    const firstPass = await repository.saveMany([
      {
        placeId: "abc",
        companyName: "Empresa A",
        phoneNumber: "1111-1111"
      }
    ]);

    const secondPass = await repository.saveMany([
      {
        placeId: "abc",
        companyName: "Empresa A Atualizada",
        phoneNumber: "2222-2222"
      }
    ]);

    expect(firstPass).toHaveLength(1);
    expect(secondPass).toHaveLength(1);
    expect(secondPass[0]).toMatchObject({
      id: "abc",
      companyName: "Empresa A Atualizada",
      phoneNumber: "2222-2222"
    });
  });

  it("updates a lead status", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "lead-status-"));
    const repository = new LeadQueueRepository();

    await repository.saveMany([
      {
        placeId: "xyz",
        companyName: "Empresa B",
        phoneNumber: "3333-3333"
      }
    ]);

    const lead = await repository.updateStatus("xyz", "approved");

    expect(lead?.status).toBe("approved");
  });
});
