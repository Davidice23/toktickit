import argon2 from "argon2";
import type { NextFunction, Request, Response } from "express";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { RequesterUser, Session } from "@prisma/client";
import { getPrisma } from "./prisma.js";

export const SESSION_COOKIE = "toktickit_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;
const CSRF_SECRET = process.env.CSRF_SECRET ?? "lab3-local-csrf-secret";
const failureWindowMs = 15 * 60 * 1000;
const failures = new Map<string, number[]>();

export type AuthContext = {
  session: Session;
  user: RequesterUser;
  rawToken: string;
};

export type AuthenticatedRequest = Request & { auth?: AuthContext };

function errorBody(code: string, message: string, fields?: Record<string, string>, correlationId?: string) {
  return { error: { code, message, ...(fields ? { fields } : {}), ...(correlationId ? { correlationId } : {}) } };
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized && normalized.length <= 320 ? normalized : null;
}

export function validatePassword(password: unknown, confirmation?: unknown): Record<string, string> {
  const fields: Record<string, string> = {};
  if (typeof password !== "string" || password.length < 12 || password.length > 128 || !/\S/.test(password)) {
    fields.password = "Password must be 12-128 characters and contain a non-whitespace character";
  }
  if (confirmation !== undefined && password !== confirmation) fields.confirmPassword = "Passwords must match";
  return fields;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string | null, password: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function safeUser(user: RequesterUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
}

function hashOpaque(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function randomOpaque(): string {
  return randomBytes(32).toString("base64url");
}

function csrfForSession(rawToken: string): string {
  return createHmac("sha256", CSRF_SECRET).update(`toktickit-csrf:${rawToken}`).digest("base64url");
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(header.split(";").flatMap((part) => {
    const index = part.indexOf("=");
    if (index < 0) return [];
    return [[part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]];
  }));
}

function cookie(value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function clearSessionCookie(res: Response): void {
  res.setHeader("Set-Cookie", cookie("", 0));
}

export async function createSession(userId: number) {
  const rawToken = randomOpaque();
  const rawCsrfToken = csrfForSession(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);
  const session = await getPrisma().session.create({
    data: {
      tokenHash: hashOpaque(rawToken),
      csrfTokenHash: hashOpaque(rawCsrfToken),
      userId,
      expiresAt,
    },
  });
  return { session, rawToken, rawCsrfToken, expiresAt };
}

export async function getCsrfToken(sessionId: number, rawToken: string): Promise<string> {
  const rawCsrfToken = csrfForSession(rawToken);
  await getPrisma().session.update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } });
  return rawCsrfToken;
}

export function setSessionCookie(res: Response, rawToken: string): void {
  res.setHeader("Set-Cookie", cookie(rawToken, SESSION_MAX_AGE_SECONDS));
}

function sameSecret(expected: string, actual: string | undefined): boolean {
  if (!actual) return false;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(actual, "utf8");
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

async function loadAuth(req: Request): Promise<AuthContext | null> {
  const rawToken = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!rawToken) return null;
  const session = await getPrisma().session.findUnique({ where: { tokenHash: hashOpaque(rawToken) } });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  const user = await getPrisma().requesterUser.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) return null;
  await getPrisma().session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  return { session, user, rawToken };
}

export async function requireSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = await loadAuth(req);
    if (!auth) {
      res.status(401).json(errorBody("UNAUTHENTICATED", "Authentication is required"));
      return;
    }
    (req as AuthenticatedRequest).auth = auth;
    next();
  } catch {
    res.status(401).json(errorBody("UNAUTHENTICATED", "Authentication is required"));
  }
}

export function requireNormalSession(req: Request, res: Response, next: NextFunction): void {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) {
    res.status(401).json(errorBody("UNAUTHENTICATED", "Authentication is required"));
    return;
  }
  if (auth.user.mustChangePassword) {
    res.status(403).json(errorBody("PASSWORD_CHANGE_REQUIRED", "Password change is required before continuing"));
    return;
  }
  next();
}

export function requireRoles(...roles: RequesterUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth) {
      res.status(401).json(errorBody("UNAUTHENTICATED", "Authentication is required"));
      return;
    }
    if (!roles.includes(auth.user.role)) {
      res.status(403).json(errorBody("FORBIDDEN", "You are not allowed to perform this operation"));
      return;
    }
    next();
  };
}

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) {
    res.status(401).json(errorBody("UNAUTHENTICATED", "Authentication is required"));
    return;
  }
  if (!sameSecret(auth.session.csrfTokenHash, hashOpaque(String(req.header("X-CSRF-Token") ?? "")))) {
    res.status(403).json(errorBody("CSRF_INVALID", "A valid CSRF token is required"));
    return;
  }
  next();
}

export function loginFailureKey(req: Request, email: string): string {
  return `${email}|${req.ip || req.socket.remoteAddress || "unknown"}`;
}

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((timestamp) => now - timestamp < failureWindowMs);
  failures.set(key, recent);
  return recent.length >= 5;
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((timestamp) => now - timestamp < failureWindowMs);
  recent.push(now);
  failures.set(key, recent);
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}

export function csrfMatches(sessionHash: string, rawToken: string | undefined): boolean {
  return sameSecret(sessionHash, hashOpaque(rawToken ?? ""));
}

export { errorBody, SESSION_MAX_AGE_SECONDS };
