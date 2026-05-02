import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_COOKIE_NAME,
  DEV_ADMIN_PASSWORD,
  DEV_ADMIN_USERNAME,
  DEV_SESSION_SECRET,
} from "@/lib/constants";
import { AdminSessionPayload } from "@/lib/types";

function getAdminUsername(): string {
  return process.env.NATILLERA_ADMIN_USERNAME || DEV_ADMIN_USERNAME;
}

function getAdminPassword(): string {
  return process.env.NATILLERA_ADMIN_PASSWORD || DEV_ADMIN_PASSWORD;
}

function getSessionSecret(): string {
  return process.env.NATILLERA_SESSION_SECRET || DEV_SESSION_SECRET;
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function adminUsesFallbackCredentials(): boolean {
  return !process.env.NATILLERA_ADMIN_USERNAME || !process.env.NATILLERA_ADMIN_PASSWORD;
}

function createSessionToken(payload: AdminSessionPayload): string {
  const serialized = JSON.stringify(payload);
  const encoded = Buffer.from(serialized).toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

function parseSessionToken(token?: string): AdminSessionPayload | null {
  if (!token) {
    return null;
  }

  const [encoded, signature] = token.split(".");

  if (!encoded || !signature || !safeEqual(sign(encoded), signature)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as AdminSessionPayload;

  if (payload.username !== getAdminUsername()) {
    return null;
  }

  return payload;
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return parseSessionToken(token);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const session = await getAdminSession();
  return Boolean(session);
}

export async function requireAdminSession(): Promise<AdminSessionPayload> {
  const session = await getAdminSession();

  if (!session) {
    redirect("/login?next=/admin");
  }

  return session;
}

export async function loginAdmin(username: string, password: string): Promise<boolean> {
  const usernameMatches = safeEqual(username, getAdminUsername());
  const passwordMatches = safeEqual(password, getAdminPassword());

  if (!usernameMatches || !passwordMatches) {
    return false;
  }

  const payload: AdminSessionPayload = {
    username,
    issuedAt: new Date().toISOString(),
  };

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, createSessionToken(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return true;
}

export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}
