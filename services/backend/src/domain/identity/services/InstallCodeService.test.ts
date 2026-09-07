import { HttpError } from "@backend-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JwtContextMock } from "../../../../test/mock/common";
import type { InstallCodeRepository } from "../repositories/InstallCodeRepository";
import { InstallCodeService } from "./InstallCodeService";

function makeService() {
    const repository = {
        create: vi.fn(),
        findByCode: vi.fn(),
    };
    const service = new InstallCodeService(
        repository as unknown as InstallCodeRepository
    );
    return { service, repository };
}

describe("InstallCodeService", () => {
    beforeEach(() => {
        JwtContextMock.installTicket.sign.mockClear();
        JwtContextMock.installTicket.verify.mockClear();
    });

    describe("generate", () => {
        it("returns only the code and expiry, never the row's internals", async () => {
            const { service, repository } = makeService();
            const expiresAt = new Date(Date.now() + 72 * 3600 * 1000);
            repository.create.mockResolvedValue({
                id: "id-1",
                code: "ABC234",
                merchantId: "merchant-1",
                anonymousId: "anon-1",
                createdAt: new Date(),
                expiresAt,
                attempts: 0,
                reused: false,
            });

            const result = await service.generate({
                merchantId: "merchant-1",
                anonymousId: "anon-1",
            });

            expect(result).toEqual({ code: "ABC234", expiresAt });
        });

        it("returns a reused code unchanged", async () => {
            const { service, repository } = makeService();
            const expiresAt = new Date(Date.now() + 40 * 3600 * 1000);
            repository.create.mockResolvedValue({
                id: "id-1",
                code: "REUSED",
                merchantId: "merchant-1",
                anonymousId: "anon-1",
                createdAt: new Date(Date.now() - 32 * 3600 * 1000),
                expiresAt,
                attempts: 2,
                reused: true,
            });

            const result = await service.generate({
                merchantId: "merchant-1",
                anonymousId: "anon-1",
            });

            expect(result).toEqual({ code: "REUSED", expiresAt });
        });
    });

    describe("resolve", () => {
        it("returns the merchantId/anonymousId for a valid code", async () => {
            const { service, repository } = makeService();
            repository.findByCode.mockResolvedValue({
                merchantId: "merchant-1",
                anonymousId: "anon-1",
            });

            const result = await service.resolve({ code: "ABC123" });

            expect(result).toEqual({
                merchantId: "merchant-1",
                anonymousId: "anon-1",
            });
        });

        it("throws CODE_NOT_FOUND when the code is expired, unknown, or attempt-exhausted", async () => {
            const { service, repository } = makeService();
            repository.findByCode.mockResolvedValue(null);

            await expect(
                service.resolve({ code: "ABC123" })
            ).rejects.toBeInstanceOf(HttpError);
            await expect(
                service.resolve({ code: "ABC123" })
            ).rejects.toMatchObject({ code: "CODE_NOT_FOUND", status: 404 });
        });
    });

    describe("mintTicket", () => {
        it("signs a ticket from the resolved merchantId/anonymousId, unconditionally", async () => {
            const { service } = makeService();
            JwtContextMock.installTicket.sign.mockResolvedValueOnce(
                "signed-ticket" as never
            );

            const ticket = await service.mintTicket({
                merchantId: "merchant-1",
                anonymousId: "anon-1",
            });

            expect(ticket).toBe("signed-ticket");
            expect(JwtContextMock.installTicket.sign).toHaveBeenCalledWith(
                expect.objectContaining({
                    sub: "anon-1",
                    mid: "merchant-1",
                })
            );
        });
    });

    describe("verifyTicket", () => {
        it("returns the identity a valid ticket authenticates", async () => {
            const { service } = makeService();
            JwtContextMock.installTicket.verify.mockResolvedValueOnce({
                sub: "anon-1",
                mid: "merchant-1",
                aud: "install-ticket",
            } as never);

            const result = await service.verifyTicket("valid-ticket");

            expect(result).toEqual({
                anonymousId: "anon-1",
                merchantId: "merchant-1",
            });
        });

        it("returns null for an invalid or expired ticket, rather than throwing", async () => {
            const { service } = makeService();
            JwtContextMock.installTicket.verify.mockResolvedValueOnce(
                null as never
            );

            const result = await service.verifyTicket("bad-ticket");

            expect(result).toBeNull();
        });
    });
});
