import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
import { createAdminToken, verifyAdminToken, verifyAdminPassword } from "../src/lib/admin-session";
const secret = "a-test-only-session-secret-with-32-characters";
const profile = { login: "amissa", displayName: "amissa", role: "Administrator" as const };
beforeEach(() => { vi.stubEnv("ADMIN_SESSION_SECRET", secret); vi.stubEnv("ADMIN_AMISSA_PASSWORD", "test-password"); });
describe("admin sessions", () => {
  it("accepts only configured credentials", () => {
    expect(verifyAdminPassword("amissa", "test-password")).toEqual(profile);
    expect(verifyAdminPassword("amissa", "wrong")).toBeNull();
    expect(verifyAdminPassword("unknown", "test-password")).toBeNull();
  });
  it("round-trips signed sessions and rejects tampering", () => {
    const token = createAdminToken(profile);
    expect(verifyAdminToken(token)).toEqual(profile);
    expect(verifyAdminToken(token + "x")).toBeNull();
    expect(verifyAdminToken(token + ".extra")).toBeNull();
  });
  it.each([undefined, null, "tomorrow", 0, Date.now() - 1])("rejects invalid or expired expiry %s", exp => {
    const payload = Buffer.from(JSON.stringify({ ...profile, exp })).toString("base64url");
    const signature = createHmac("sha256", secret).update(payload).digest("base64url");
    expect(verifyAdminToken(`${payload}.${signature}`)).toBeNull();
  });
  it("fails closed without a strong session secret", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "short");
    expect(() => createAdminToken(profile)).toThrow();
    expect(verifyAdminToken("payload.signature")).toBeNull();
  });
});
