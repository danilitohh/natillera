"use server";

import { redirect } from "next/navigation";

import { loginAdmin } from "@/lib/auth";
import { buildMessageUrl, parseString } from "@/lib/utils";

function sanitizeNextPath(nextPath: string): string {
  if (!nextPath.startsWith("/")) {
    return "/admin";
  }

  if (nextPath.startsWith("//")) {
    return "/admin";
  }

  return nextPath;
}

export async function loginAction(formData: FormData): Promise<void> {
  const username = parseString(formData.get("username"));
  const password = parseString(formData.get("password"));
  const nextPath = sanitizeNextPath(parseString(formData.get("next")) || "/admin");

  if (!username || !password) {
    redirect(buildMessageUrl("/login", { error: "Completa usuario y contraseña." }));
  }

  const success = await loginAdmin(username, password);

  if (!success) {
    redirect(buildMessageUrl("/login", { error: "Credenciales inválidas." }));
  }

  redirect(nextPath);
}
