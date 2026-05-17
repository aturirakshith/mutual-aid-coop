/**
 * Core login logic for POST /api/auth/login.
 *
 * Kept framework-free so it can be unit-tested without Next.js overhead.
 * The route handler (`app/api/auth/login/route.ts`) is a thin wrapper.
 *
 * PRD §6.1:
 *   FR-1.1 — username = 10-digit mobile number + password
 *   FR-1.2 — two roles (admin / member); role embedded in token
 *   FR-1.5 — sessions expire after 30 days of inactivity (JWT exp)
 */
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

// ─── Validation ───────────────────────────────────────────────────────────────

const loginSchema = z.object({
  mobile: z
    .string({ required_error: "mobile is required" })
    .length(10, "mobile must be exactly 10 digits")
    .regex(/^\d{10}$/, "mobile must contain only digits"),
  password: z
    .string({ required_error: "password is required" })
    .min(1, "password is required"),
});

// ─── Types ────────────────────────────────────────────────────────────────────

/** User fields safe to return to callers — never includes passwordHash. */
export type SafeUser = {
  id: string;
  name: string;
  mobile: string;
  /** "ADMIN" | "MEMBER" — FR-1.2 */
  role: string;
  /** True when an admin has reset the password and the member hasn't changed it yet. */
  mustChangePassword: boolean;
  groupId: string;
};

/** Shape of the 200 OK body returned by POST /api/auth/login. */
export type LoginResponse = { token: string; user: SafeUser };

// ─── Constants ────────────────────────────────────────────────────────────────

const INVALID_CREDENTIALS = "Invalid mobile number or password";
const JWT_TTL_SECONDS = 30 * 24 * 60 * 60; // FR-1.5

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jwtSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return secret ?? "macs-fallback-secret-for-tests";
}

function sanitizeUser(user: {
  id: string; name: string; mobile: string; role: string;
  mustChangePassword: boolean; groupId: string;
}): SafeUser {
  return {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    groupId: user.groupId,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * Validate credentials and issue a signed JWT.
 *
 * @param body - Raw parsed request body (unknown — validated internally with zod).
 * @returns
 *   - `400` — missing / malformed fields (e.g. mobile not 10 digits, empty password).
 *   - `401` — unknown user or wrong password (same message for both to prevent enumeration).
 *   - `200` — `{ token: string; user: SafeUser }`.
 *
 * The JWT payload: `{ sub, role, groupId }`, HS256, 30-day expiry (FR-1.5).
 */
export async function handleLogin(body: unknown): Promise<Response> {
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message
      ?? "mobile must be 10 digits and password is required";
    return Response.json({ error: message }, { status: 400 });
  }

  const { mobile, password } = parsed.data;

  const user = await prisma.user.findFirst({ where: { mobile, active: true } });
  if (!user) {
    return Response.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return Response.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role, groupId: user.groupId },
    jwtSecret(),
    { expiresIn: JWT_TTL_SECONDS },
  );

  return Response.json({ token, user: sanitizeUser(user) } satisfies LoginResponse);
}
