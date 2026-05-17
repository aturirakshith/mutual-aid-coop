/**
 * POST /api/auth/login
 *
 * Stateless REST login endpoint — returns a signed JWT for API / mobile clients.
 * The Next.js web UI uses Auth.js sessions via /api/auth/[...nextauth] instead;
 * this endpoint exists for programmatic access.
 *
 * PRD §6.1: FR-1.1, FR-1.2, FR-1.5
 */
import { handleLogin } from "@/lib/login";

export async function POST(request: Request): Promise<Response> {
  // Fall back to {} so zod produces field-level errors instead of "Expected object"
  const body = await request.json().catch(() => ({}));
  return handleLogin(body);
}
