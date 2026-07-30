import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * `jose` is globally mocked (`test/mock/common.ts`) with a `SignJWT` stub
 * that always returns `"mock-jwt"` and no `jwtVerify` at all, so the real
 * mint/verify round trip can't be exercised through the normal module
 * graph. Unmock it for this file only (module registry is per-file under
 * `isolate: true`), before anything imports `jose` or `jwt.ts` for the
 * first time, so the first resolution of both picks up the real
 * implementation. Deliberately NOT calling `vi.resetModules()` here: that
 * would force a second, real (unmocked) load of the `@backend-utils`
 * barrel this file's own `jwt.ts` import pulls in, which re-registers
 * prom-client counters (`infrastructure/telemetry`) against a
 * `globalThis`-scoped registry that survives module-cache resets and
 * throws on the second registration.
 */
vi.unmock("jose");

describe("JwtContext.installTicket — mint/verify round trip", () => {
    let JwtContext: any;

    beforeAll(async () => {
        ({ JwtContext } = await import(
            "../../../src/infrastructure/external/jwt"
        ));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("mints a ticket and verifies it back to the same identity", async () => {
        const ticket = await JwtContext.installTicket.sign({
            sub: "anon-1",
            mid: "550e8400-e29b-41d4-a716-446655440000",
            jti: "11111111-1111-1111-1111-111111111111",
        });

        expect(typeof ticket).toBe("string");
        // URL-safe, ~600 chars max (defensive per README §5 table).
        expect(ticket.length).toBeLessThan(600);
        expect(ticket).toMatch(
            /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
        );

        const payload = await JwtContext.installTicket.verify(ticket);
        expect(payload).toMatchObject({
            sub: "anon-1",
            mid: "550e8400-e29b-41d4-a716-446655440000",
            aud: "install-ticket",
        });
    });

    it("rejects a same-shape token minted under a different audience", async () => {
        // The sharpest version of the cross-replay case: same secret, same
        // payload shape, only `aud` differs — so it isolates the audience
        // check itself. The `anonymousMerge` case below would still pass on
        // payload shape alone, and did while `aud` was silently unenforced.
        const { SignJWT } = await import("jose");
        const token = await new SignJWT({
            sub: "victim-anon-id",
            mid: "550e8400-e29b-41d4-a716-446655440000",
            jti: "11111111-1111-1111-1111-111111111111",
            aud: "some-other-audience",
        })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(new TextEncoder().encode(process.env.JWT_SDK_SECRET));

        expect(await JwtContext.installTicket.verify(token)).toBe(false);
    });

    it("rejects a token minted for a different audience (anonymousMerge)", async () => {
        const mergeToken = await JwtContext.anonymousMerge.sign({
            sourceGroupId: "550e8400-e29b-41d4-a716-446655440000",
            sourceMerchantId: "550e8400-e29b-41d4-a716-446655440000",
        });

        expect(await JwtContext.installTicket.verify(mergeToken)).toBe(false);
    });

    it("rejects an install ticket verified as an anonymousMerge token (reverse direction)", async () => {
        // Note this direction is currently blocked by payload SHAPE, not by
        // the audience: `anonymousMerge` declares no `aud`, so jose enforces
        // nothing, and the rejection comes from `AnonymousMergeTokenDto`
        // requiring sourceGroupId/sourceMerchantId. Adding an `aud` to that
        // context would make this a real audience check, but it would also
        // reject every token already in flight — verified: jose fails a
        // token with no `aud` the moment an audience is required — which
        // for `walletSdk`/`anonymousMerge` means logging users out mid
        // session. Not worth it for defence-in-depth on a case the schemas
        // already cover; revisit behind a dual-accept window if a future
        // token type on this secret has a shape that collides.
        const ticket = await JwtContext.installTicket.sign({
            sub: "anon-1",
            mid: "550e8400-e29b-41d4-a716-446655440000",
            jti: "11111111-1111-1111-1111-111111111111",
        });

        expect(await JwtContext.anonymousMerge.verify(ticket)).toBe(false);
    });

    it("rejects an expired ticket", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);

        const ticket = await JwtContext.installTicket.sign({
            sub: "anon-1",
            mid: "550e8400-e29b-41d4-a716-446655440000",
            jti: "11111111-1111-1111-1111-111111111111",
        });

        // One week TTL — step one second past it.
        vi.setSystemTime(7 * 24 * 60 * 60 * 1000 + 1000);

        expect(await JwtContext.installTicket.verify(ticket)).toBe(false);
    });

    it("accepts a ticket just inside the one-week TTL", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);

        const ticket = await JwtContext.installTicket.sign({
            sub: "anon-1",
            mid: "550e8400-e29b-41d4-a716-446655440000",
            jti: "11111111-1111-1111-1111-111111111111",
        });

        vi.setSystemTime(7 * 24 * 60 * 60 * 1000 - 1000);

        const payload = await JwtContext.installTicket.verify(ticket);
        expect(payload).not.toBe(false);
    });
});
