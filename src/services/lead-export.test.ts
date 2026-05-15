import { describe, expect, it } from "vitest";

import { normalizeBrazilPhone } from "../domain/phone.js";
import { buildLeadXlsx } from "./lead-export.js";

describe("lead export", () => {
  it("normalizes brazilian phone numbers with country code", () => {
    expect(normalizeBrazilPhone("(48) 99958-3893")).toBe("5548999583893");
    expect(normalizeBrazilPhone("+55 (48) 3255-1367")).toBe("554832551367");
  });

  it("builds a xlsx with normalized phones", () => {
    // const excelBuffer = buildLeadXlsx([...])
    // Todo: Implement xlsx buffer testing
  });
});
