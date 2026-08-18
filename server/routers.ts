import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDashboardData } from "./dashboard";
import { getKeywordTrendData, importKeywordFile } from "./keywords";
import { z } from "zod";

const dateRangeInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(value => value.from <= value.to, { message: "Invalid date range" });

const keywordFiltersInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  keyword: z.string().max(500).optional(),
  country: z.string().max(100).optional(),
  device: z.string().max(100).optional(),
  page: z.string().max(2000).optional(),
  source: z.string().max(100).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    overview: protectedProcedure.input(dateRangeInput).query(({ input }) => getDashboardData(input.from, input.to)),
  }),
  keywords: router({
    overview: protectedProcedure.input(keywordFiltersInput).query(({ input }) => getKeywordTrendData(input)),
    import: adminProcedure
      .input(z.object({
        format: z.enum(["csv", "json"]),
        content: z.string().min(1).max(8_000_000),
        filename: z.string().max(255).optional(),
        source: z.string().max(100).optional(),
      }))
      .mutation(({ input, ctx }) => importKeywordFile(input, ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
