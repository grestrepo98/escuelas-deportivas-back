import type {Request} from "express";

export function deviceOf(request: Request): {userAgent?: string} {
  const userAgent = request.get("user-agent");
  return userAgent ? {userAgent} : {};
}
