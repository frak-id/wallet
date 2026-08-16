import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it } from "vitest";
import { dbMock } from "../../../../test/mock/common";
import {
    InstallCodeRepository,
    MAX_RESOLVE_ATTEMPTS,
} from "./InstallCodeRepository";

function renderLastStatement(): { sql: string; params: unknown[] } {
    const call = dbMock.execute.mock.calls.at(-1);
    const query = new PgDialect().sqlToQuery(call?.[0] as never);
    return { sql: query.sql, params: query.params };
}

/**
 * `db.execute` is mocked, so the reuse predicate — remaining life, attempt
 * cap, race safety — is NOT covered here. Row mapping only.
 */
describe("InstallCodeRepository.create", () => {
    const row = {
        id: "id-1",
        code: "ABC234",
        merchant_id: "merchant-1",
        anonymous_id: "anon-1",
        checkout_token: null,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 72 * 3600 * 1000),
        attempts: 0,
    };

    beforeEach(() => {
        dbMock.__reset();
    });

    it("maps a freshly minted row and flags it as not reused", async () => {
        dbMock.__setExecuteResponse(() =>
            Promise.resolve([{ ...row, reused: false }])
        );

        const result = await new InstallCodeRepository().create({
            merchantId: "merchant-1",
            credential: { kind: "anonymous", anonymousId: "anon-1" },
        });

        expect(result).toMatchObject({
            code: "ABC234",
            merchantId: "merchant-1",
            anonymousId: "anon-1",
            reused: false,
        });
    });

    it("maps a reused row and flags it", async () => {
        dbMock.__setExecuteResponse(() =>
            Promise.resolve([{ ...row, attempts: 3, reused: true }])
        );

        const result = await new InstallCodeRepository().create({
            merchantId: "merchant-1",
            credential: { kind: "anonymous", anonymousId: "anon-1" },
        });

        expect(result).toMatchObject({ code: "ABC234", reused: true });
        expect(result.attempts).toBe(3);
    });

    it("probes reuse on the checkout token when no anonymousId is carried", async () => {
        dbMock.__setExecuteResponse(() =>
            Promise.resolve([
                {
                    ...row,
                    anonymous_id: null,
                    checkout_token: "tok-1",
                    reused: true,
                },
            ])
        );

        const result = await new InstallCodeRepository().create({
            merchantId: "merchant-1",
            credential: {
                kind: "checkoutToken",
                checkoutToken: "tok-1",
                anonymousId: null,
            },
        });

        expect(result).toMatchObject({
            anonymousId: null,
            checkoutToken: "tok-1",
            reused: true,
        });
        const { sql, params } = renderLastStatement();
        expect(sql).toContain("checkout_token = ");
        expect(params).toContain("tok-1");
        expect(params).not.toContain("anon-1");
    });

    it("keeps the anonymousId arm intact when a call carries both", async () => {
        dbMock.__setExecuteResponse(() =>
            Promise.resolve([
                { ...row, checkout_token: "tok-1", reused: false },
            ])
        );

        const result = await new InstallCodeRepository().create({
            merchantId: "merchant-1",
            credential: {
                kind: "checkoutToken",
                checkoutToken: "tok-1",
                anonymousId: "anon-1",
            },
        });

        expect(result.anonymousId).toBe("anon-1");
        expect(renderLastStatement().params).toContain("anon-1");
    });

    it("probes both identifiers so a deferred row survives its id resolving", async () => {
        dbMock.__setExecuteResponse(() =>
            Promise.resolve([{ ...row, checkout_token: "tok-1", reused: true }])
        );

        await new InstallCodeRepository().create({
            merchantId: "merchant-1",
            credential: {
                kind: "checkoutToken",
                checkoutToken: "tok-1",
                anonymousId: "anon-1",
            },
        });

        const { sql, params } = renderLastStatement();
        expect(sql).toContain("anonymous_id = ");
        expect(sql).toContain("checkout_token = ");
        expect(params).toContain("anon-1");
        expect(params).toContain("tok-1");
    });

    it("throws when neither arm produced a row (every candidate collided)", async () => {
        dbMock.__setExecuteResponse(() => Promise.resolve([]));

        await expect(
            new InstallCodeRepository().create({
                merchantId: "merchant-1",
                credential: { kind: "anonymous", anonymousId: "anon-1" },
            })
        ).rejects.toThrow(/Failed to generate unique install code/);
    });
});

/**
 * `findByCode` counts the attempt in the same UPDATE ... RETURNING as the
 * lookup, so the exhaustion check and the increment can't race across
 * concurrent guesses. The mock's `update` chain ignores the `where`
 * condition, so these tests only exercise row mapping and the "absent
 * means null" contract, not the generated SQL predicate itself.
 */
describe("InstallCodeRepository.findByCode", () => {
    beforeEach(() => {
        dbMock.__reset();
    });

    it("returns the row when the update matches (code exists, not expired, under the attempt cap)", async () => {
        const row = {
            id: "id-1",
            code: "ABC234",
            merchantId: "merchant-1",
            anonymousId: "anon-1",
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 1000),
            attempts: 3,
        };
        dbMock.__setUpdateResponse(() => Promise.resolve([row]));

        const repo = new InstallCodeRepository();
        const result = await repo.findByCode("abc234");

        expect(result).toEqual(row);
    });

    it("returns null when nothing matches — expired, unknown, and exhausted are indistinguishable by design", async () => {
        dbMock.__setUpdateResponse(() => Promise.resolve([]));

        const repo = new InstallCodeRepository();
        const result = await repo.findByCode("ZZZZZZ");

        expect(result).toBeNull();
    });

    it("exports a finite, positive attempt cap", () => {
        expect(MAX_RESOLVE_ATTEMPTS).toBeGreaterThan(0);
        expect(Number.isFinite(MAX_RESOLVE_ATTEMPTS)).toBe(true);
    });
});
