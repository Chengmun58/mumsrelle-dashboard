import "dotenv/config";
import { fetchRequestHandler, type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { parse as parseCookieHeader, serialize as serializeCookie } from "cookie";
import type { CookieOptions } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "../../shared/const";
import * as db from "../../server/db";
import { appRouter } from "../../server/routers";
import type { TrpcContext } from "../../server/_core/context";
import { getSessionCookieOptions } from "../../server/_core/cookies";
import { ENV } from "../../server/_core/env";
import type { RequestLike } from "../../server/_core/httpTypes";
import { sdk } from "../../server/_core/sdk";

const DASHBOARD_ACCESS_COOKIE = "mumsrelle_dashboard_access";
const DASHBOARD_ACCESS_TTL_SECONDS = 12 * 60 * 60;

function accessSecret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not configured");
  return new TextEncoder().encode(value);
}

async function hasDashboardAccess(request: Request) {
  const token = parseCookieHeader(request.headers.get("cookie") ?? "")[DASHBOARD_ACCESS_COOKIE];
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, accessSecret(), { algorithms: ["HS256"] });
    return payload.scope === "mumsrelle-dashboard";
  } catch {
    return false;
  }
}

function passwordMatches(password: string) {
  const expected = process.env.DASHBOARD_PASSWORD_HASH?.trim().toLowerCase();
  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) return false;
  const actual = createHash("sha256").update(password, "utf8").digest();
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

async function handlePasswordLogin(request: Request) {
  let password = "";
  try {
    const body = await request.json() as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (!password || password.length > 256 || !passwordMatches(password)) {
    return json({ error: "Incorrect password" }, 401);
  }
  const token = await new SignJWT({ scope: "mumsrelle-dashboard" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${DASHBOARD_ACCESS_TTL_SECONDS}s`)
    .sign(accessSecret());
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
  headers.append("Set-Cookie", cookieHeader(DASHBOARD_ACCESS_COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
    maxAge: DASHBOARD_ACCESS_TTL_SECONDS,
  }));
  return secureResponse(new Response(JSON.stringify({ success: true }), { status: 200, headers }));
}

function toRequestLike(request: Request): RequestLike {
  const headers: RequestLike["headers"] = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return {
    headers,
    protocol: new URL(request.url).protocol.replace(":", ""),
  };
}

function cookieHeader(
  name: string,
  value: string,
  options: CookieOptions = {},
) {
  const sameSite =
    options.sameSite === true
      ? "strict"
      : options.sameSite === "lax" ||
          options.sameSite === "strict" ||
          options.sameSite === "none"
        ? options.sameSite
        : undefined;
  return serializeCookie(name, value, {
    domain: options.domain,
    expires: options.expires,
    httpOnly: options.httpOnly,
    maxAge: options.maxAge,
    path: options.path,
    sameSite,
    secure: options.secure,
  });
}

function clearCookieHeader(name: string, options: CookieOptions = {}) {
  return cookieHeader(name, "", {
    ...options,
    expires: new Date(0),
    maxAge: 0,
  });
}

async function createFetchContext({
  req,
  resHeaders,
}: FetchCreateContextFnOptions): Promise<TrpcContext> {
  const request = toRequestLike(req);
  let user: TrpcContext["user"] = null;
  try {
    user = await sdk.authenticateRequest(request);
  } catch {
    user = null;
  }

  return {
    req: request,
    res: {
      clearCookie(name, options) {
        resHeaders.append("Set-Cookie", clearCookieHeader(name, options));
      },
    },
    user,
  };
}

function secureResponse(response: Response, apiRequest = true) {
  const headers = new Headers(response.headers);
  const getSetCookie = (response.headers as Headers & {
    getSetCookie?: () => string[];
  }).getSetCookie;
  if (getSetCookie) {
    const cookies = getSetCookie.call(response.headers);
    if (cookies.length > 0) {
      headers.delete("Set-Cookie");
      for (const cookie of cookies) headers.append("Set-Cookie", cookie);
    }
  }
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (apiRequest) headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function json(body: unknown, status = 200) {
  return secureResponse(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }),
  );
}

async function handleOAuthCallback(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? undefined;
  const state = url.searchParams.get("state") ?? undefined;
  if (!code || !state) return json({ error: "code and state are required" }, 400);

  const { nonce } = decodeOAuthState(state);
  const expectedNonce = parseCookieHeader(request.headers.get("cookie") ?? "")[OAUTH_STATE_COOKIE];
  if (!nonce || nonce !== expectedNonce) return json({ error: "invalid oauth state" }, 403);

  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    clearCookieHeader(OAUTH_STATE_COOKIE, {
      path: "/",
      secure: true,
      sameSite: "none",
    }),
  );

  try {
    const tokenResponse = await sdk.exchangeCodeForToken(code, state);
    const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
    if (!userInfo.openId) return json({ error: "openId missing from user info" }, 400);

    await db.upsertUser({
      openId: userInfo.openId,
      name: userInfo.name || null,
      email: userInfo.email ?? null,
      loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
      lastSignedIn: new Date(),
    });

    const sessionToken = await sdk.createSessionToken(userInfo.openId, {
      name: userInfo.name || "",
      expiresInMs: ONE_YEAR_MS,
    });
    headers.append(
      "Set-Cookie",
      cookieHeader(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(toRequestLike(request)),
        maxAge: Math.floor(ONE_YEAR_MS / 1000),
      }),
    );
    headers.set("Location", new URL("/", request.url).toString());
    return secureResponse(new Response(null, { status: 302, headers }));
  } catch (error) {
    console.error("[OAuth] Callback failed", error);
    return json({ error: "OAuth callback failed" }, 500);
  }
}

async function handleStorageProxy(request: Request) {
  const key = decodeURIComponent(new URL(request.url).pathname.replace(/^\/manus-storage\//, ""));
  if (!key) return new Response("Missing storage key", { status: 400 });
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    return new Response("Storage proxy not configured", { status: 500 });
  }

  try {
    const forgeUrl = new URL(
      "v1/storage/presign/get",
      `${ENV.forgeApiUrl.replace(/\/+$/, "")}/`,
    );
    forgeUrl.searchParams.set("path", key);
    const response = await fetch(forgeUrl, {
      headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
    });
    if (!response.ok) return new Response("Storage backend error", { status: 502 });
    const { url } = (await response.json()) as { url?: string };
    if (!url) return new Response("Empty signed URL from backend", { status: 502 });
    return new Response(null, {
      status: 307,
      headers: { Location: url, "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[StorageProxy] failed", error);
    return new Response("Storage proxy error", { status: 502 });
  }
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/health") return json({ status: "ok" });
  if (url.pathname === "/api/password/status" && request.method === "GET") {
    return json({ authenticated: await hasDashboardAccess(request) });
  }
  if (url.pathname === "/api/password/login" && request.method === "POST") {
    return handlePasswordLogin(request);
  }
  if (url.pathname === "/api/oauth/callback") return handleOAuthCallback(request);
  if (url.pathname.startsWith("/manus-storage/")) {
    return secureResponse(await handleStorageProxy(request), false);
  }
  if (!url.pathname.startsWith("/api/trpc")) return json({ error: "Not found" }, 404);
  if (!(await hasDashboardAccess(request))) return json({ error: "Unauthorized" }, 401);

  const origin = request.headers.get("origin");
  if (request.method !== "GET" && origin) {
    try {
      if (new URL(origin).host !== url.host) {
        return json({ error: "Cross-origin API request rejected" }, 403);
      }
    } catch {
      return json({ error: "Invalid request origin" }, 403);
    }
  }

  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: createFetchContext,
  });
  return secureResponse(response);
}

export const config = {
  path: ["/api/*", "/manus-storage/*"],
};
