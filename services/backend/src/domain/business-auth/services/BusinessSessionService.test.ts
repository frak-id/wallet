import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BusinessSessionSelect } from "../db/schema";
import type { BusinessSessionRepository } from "../repositories/BusinessSessionRepository";
import {
    BusinessSessionService,
    SESSION_TTL_MS,
    STEP_UP_WINDOW_MS,
} from "./BusinessSessionService";

const createRepository = () =>
    ({
        findById: vi.fn(),
        create: vi.fn(async (params: Record<string, unknown>) => ({
            ...params,
            createdAt: new Date(),
            lastUsedAt: new Date(),
            twoFactorVerifiedAt: params.twoFactorVerifiedAt ?? null,
            twoFactorNonce: null,
            ip: null,
            userAgent: null,
        })),
        touch: vi.fn(),
        revoke: vi.fn(),
        setTwoFactorVerified: vi.fn(),
    }) as unknown as BusinessSessionRepository &
        Record<string, ReturnType<typeof vi.fn>>;

describe("BusinessSessionService", () => {
    let repository: ReturnType<typeof createRepository>;
    let service: BusinessSessionService;

    beforeEach(() => {
        repository = createRepository();
        service = new BusinessSessionService(
            repository as unknown as BusinessSessionRepository
        );
    });

    describe("create", () => {
        it("returns a raw token and stores only its hash", async () => {
            const { token, session } = await service.create({
                accountId: "acc-1",
                authMethod: "password",
            });

            expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32B base64url
            const stored = repository.create.mock.calls[0][0];
            expect(stored.id).not.toContain(token);
            expect(stored.id).toBe(service.hashToken(token));
            expect(stored.id).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
            expect(session.twoFactorVerifiedAt).toBeNull();
        });

        it("stamps two_factor_verified_at when twoFactorVerified", async () => {
            await service.create({
                accountId: "acc-1",
                authMethod: "siwe",
                twoFactorVerified: true,
            });
            const stored = repository.create.mock.calls[0][0];
            expect(stored.twoFactorVerifiedAt).toBeInstanceOf(Date);
        });

        it("sets a 7-day expiry", async () => {
            const before = Date.now();
            await service.create({ accountId: "acc-1", authMethod: "siwe" });
            const stored = repository.create.mock.calls[0][0];
            expect(stored.expiresAt.getTime()).toBeGreaterThanOrEqual(
                before + SESSION_TTL_MS - 1000
            );
        });
    });

    describe("resolve", () => {
        const baseSession = (
            overrides: Partial<BusinessSessionSelect>
        ): BusinessSessionSelect =>
            ({
                id: "session-hash",
                accountId: "acc-1",
                authMethod: "password",
                twoFactorVerifiedAt: null,
                twoFactorNonce: null,
                ip: null,
                userAgent: null,
                createdAt: new Date(),
                lastUsedAt: new Date(),
                expiresAt: new Date(Date.now() + SESSION_TTL_MS),
                ...overrides,
            }) as BusinessSessionSelect;

        it("returns null for an unknown token", async () => {
            repository.findById.mockResolvedValue(null);
            expect(await service.resolve("some-token")).toBeNull();
        });

        it("deletes and rejects an expired session", async () => {
            repository.findById.mockResolvedValue(
                baseSession({ expiresAt: new Date(Date.now() - 1000) })
            );
            expect(await service.resolve("some-token")).toBeNull();
            expect(repository.revoke).toHaveBeenCalled();
        });

        it("resolves a live session without touching a fresh one", async () => {
            repository.findById.mockResolvedValue(baseSession({}));
            const resolved = await service.resolve("some-token");
            expect(resolved).not.toBeNull();
            expect(repository.touch).not.toHaveBeenCalled();
        });

        it("slides the expiry once >1 day of the window is consumed", async () => {
            // 2 days consumed → remaining 5 days < TTL - 1 day
            repository.findById.mockResolvedValue(
                baseSession({
                    expiresAt: new Date(
                        Date.now() + SESSION_TTL_MS - 2 * 24 * 3600_000
                    ),
                })
            );
            const resolved = await service.resolve("some-token");
            expect(repository.touch).toHaveBeenCalled();
            // The returned session reflects the refreshed expiry
            expect(resolved?.expiresAt.getTime()).toBeGreaterThan(
                Date.now() + SESSION_TTL_MS - 60_000
            );
        });

        it("looks up by sha256(token), never the raw token", async () => {
            repository.findById.mockResolvedValue(null);
            await service.resolve("raw-token");
            expect(repository.findById).toHaveBeenCalledWith(
                service.hashToken("raw-token")
            );
        });
    });

    describe("isStepUpFresh", () => {
        it("false when never verified", () => {
            expect(service.isStepUpFresh({ twoFactorVerifiedAt: null })).toBe(
                false
            );
        });

        it("true within the 5-minute window", () => {
            expect(
                service.isStepUpFresh({
                    twoFactorVerifiedAt: new Date(
                        Date.now() - STEP_UP_WINDOW_MS + 10_000
                    ),
                })
            ).toBe(true);
        });

        it("false past the 5-minute window", () => {
            expect(
                service.isStepUpFresh({
                    twoFactorVerifiedAt: new Date(
                        Date.now() - STEP_UP_WINDOW_MS - 1000
                    ),
                })
            ).toBe(false);
        });
    });
});
