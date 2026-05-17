/**
 * POST /api/auth/login
 *
 * PRD §3.2 / §6.1 (FR-1.1, FR-1.2, FR-1.5)
 *   - FR-1.1: Login via 10-digit mobile number + password
 *   - FR-1.2: Two roles (admin / member); role returned in response
 *   - FR-1.5: Token expiry = 30 days
 *
 * Test strategy: mount the route handler in a real Node http.Server so
 * supertest drives it over a socket. Prisma is mocked — no live DB needed.
 */

import supertest from "supertest";
import http from "node:http";
import bcrypt from "bcryptjs";
import { makeServer } from "../../helpers/route-server";

// ─── Mock Prisma before importing the route ───────────────────────────────────
jest.mock("@/lib/db", () => ({
  prisma: {
    user: { findFirst: jest.fn() },
  },
}));

// eslint-disable-next-line import/first
import { prisma } from "@/lib/db";
// eslint-disable-next-line import/first
import { POST } from "@/app/api/auth/login/route";

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const PASSWORD = "member123";
const HASH = bcrypt.hashSync(PASSWORD, 10);

const MEMBER_USER = {
  id: "usr-1",
  name: "Arjun Srinivasan",
  mobile: "9876543210",
  passwordHash: HASH,
  role: "MEMBER",
  active: true,
  mustChangePassword: false,
  groupId: "grp-1",
};

const ADMIN_USER = {
  ...MEMBER_USER,
  id: "usr-admin",
  role: "ADMIN",
  passwordHash: bcrypt.hashSync("admin123", 10),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const mockFind = prisma.user.findFirst as jest.Mock;

// ─── Suite ────────────────────────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  let server: http.Server;
  let req: ReturnType<typeof supertest>;

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        server = makeServer(POST);
        server.listen(0, () => {
          req = supertest(server);
          resolve();
        });
      }),
  );

  afterAll(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  beforeEach(() => mockFind.mockReset());

  // ── 400 Bad Request ────────────────────────────────────────────────────────

  it("400 — missing body entirely", async () => {
    const res = await req.post("/").set("Content-Type", "application/json").send();
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mobile/i);
  });

  it("400 — mobile shorter than 10 digits", async () => {
    const res = await req.post("/").send({ mobile: "98765", password: PASSWORD });
    expect(res.status).toBe(400);
  });

  it("400 — mobile longer than 10 digits", async () => {
    const res = await req.post("/").send({ mobile: "98765432101", password: PASSWORD });
    expect(res.status).toBe(400);
  });

  it("400 — mobile contains non-digit characters", async () => {
    const res = await req.post("/").send({ mobile: "9876-43210", password: PASSWORD });
    expect(res.status).toBe(400);
  });

  it("400 — password is empty string (FR-1.1)", async () => {
    const res = await req.post("/").send({ mobile: "9876543210", password: "" });
    expect(res.status).toBe(400);
  });

  it("400 — password field absent", async () => {
    const res = await req.post("/").send({ mobile: "9876543210" });
    expect(res.status).toBe(400);
  });

  // ── 401 Unauthorized ──────────────────────────────────────────────────────

  it("401 — user does not exist", async () => {
    mockFind.mockResolvedValue(null);
    const res = await req.post("/").send({ mobile: "9876543210", password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("401 — correct mobile but wrong password", async () => {
    mockFind.mockResolvedValue(MEMBER_USER);
    const res = await req.post("/").send({ mobile: "9876543210", password: "wrongpass" });
    expect(res.status).toBe(401);
  });

  it("identical error message for unknown user vs wrong password (no user enumeration)", async () => {
    mockFind.mockResolvedValue(null);
    const r1 = await req.post("/").send({ mobile: "9876543210", password: "x" });

    mockFind.mockResolvedValue(MEMBER_USER);
    const r2 = await req.post("/").send({ mobile: "9876543210", password: "x" });

    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    expect(r1.body.error).toBe(r2.body.error);
  });

  // ── 200 OK ────────────────────────────────────────────────────────────────

  it("200 — valid member login returns token + safe user payload (FR-1.1, FR-1.2)", async () => {
    mockFind.mockResolvedValue(MEMBER_USER);
    const res = await req.post("/").send({ mobile: "9876543210", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toMatchObject({
      id: "usr-1",
      name: "Arjun Srinivasan",
      mobile: "9876543210",
      role: "MEMBER",
      mustChangePassword: false,
    });
  });

  it("200 — passwordHash is never returned (security)", async () => {
    mockFind.mockResolvedValue(MEMBER_USER);
    const res = await req.post("/").send({ mobile: "9876543210", password: PASSWORD });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("200 — admin login returns role ADMIN (FR-1.2)", async () => {
    mockFind.mockResolvedValue(ADMIN_USER);
    const res = await req.post("/").send({ mobile: "9876543210", password: "admin123" });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("ADMIN");
  });

  it("200 — mustChangePassword: true is forwarded", async () => {
    mockFind.mockResolvedValue({ ...MEMBER_USER, mustChangePassword: true });
    const res = await req.post("/").send({ mobile: "9876543210", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(true);
  });

  it("token is a 3-part HS256 JWT (FR-1.5 — 30-day expiry encoded in payload)", async () => {
    mockFind.mockResolvedValue(MEMBER_USER);
    const res = await req.post("/").send({ mobile: "9876543210", password: PASSWORD });

    const parts = (res.body.token as string).split(".");
    expect(parts).toHaveLength(3);

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(payload.sub).toBe("usr-1");
    expect(payload.role).toBe("MEMBER");
    // exp must be ~30 days from now (within a 60-second window)
    const thirtyDays = 30 * 24 * 60 * 60;
    expect(payload.exp - payload.iat).toBeCloseTo(thirtyDays, -2);
  });

  it("Content-Type response is application/json", async () => {
    mockFind.mockResolvedValue(MEMBER_USER);
    const res = await req.post("/").send({ mobile: "9876543210", password: PASSWORD });
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });
});
