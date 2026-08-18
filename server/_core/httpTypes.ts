import type { CookieOptions } from "express";

export type RequestLike = {
  headers: {
    cookie?: string;
    authorization?: string;
    "x-forwarded-proto"?: string | string[];
    [key: string]: string | string[] | undefined;
  };
  protocol?: string;
};

export type ResponseLike = {
  clearCookie: (name: string, options?: CookieOptions) => unknown;
};
