import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * `jose` is globally mocked (`test/mock/common.ts`); unmock it here, before
 * anything imports `jose` or `jwt.ts`, so this file's real mint/verify
 * round trip is exercised. Don't call `vi.resetModules()`: it would force a
 * second load of the `@backend-utils` barrel, re-registering prom-client
 * counters against a registry that survives cache resets and throws on
 * double registration.
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
        // URL-safe, ~600 chars max (defensive upper bound).
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
        // Blocked by payload SHAPE here, not audience: `anonymousMerge`
        // declares no `aud`, so rejection comes from `AnonymousMergeTokenDto`
        // requiring sourceGroupId/sourceMerchantId instead.
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
