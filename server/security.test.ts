import { describe, expect, it } from "vitest";
import apiHandler from "../netlify/functions/api.mts";
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
    const response = await apiHandler(
      new Request("https://dashboard.example/api/trpc/dashboard.overview")
    );
    expect(response.status).toBe(401);
  });

  it("rejects anonymous keyword reads and imports", async () => {
    const caller = appRouter.createCaller(anonymousContext());
    await expect(caller.keywords.overview({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      caller.keywords.import({
        format: "csv",
        content: "date,keyword\n2026-08-18,test\n",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
