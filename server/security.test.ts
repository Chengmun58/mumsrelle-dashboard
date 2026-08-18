import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function anonymousContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("dashboard access control", () => {
  it("rejects anonymous dashboard reads", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.dashboard.overview({ from: "2026-08-01", to: "2026-08-31" }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects anonymous keyword reads and imports", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.keywords.overview({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.keywords.import({
      format: "csv",
      content: "date,keyword\n2026-08-18,test\n",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
