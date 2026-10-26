import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../src/utils/httpError";

const GROUP = "group-1";
const CHECKED_AT = new Date("2026-10-26T10:00:00Z");
const LINK = { username: "frak_fr", follows: true, checkedAt: CHECKED_AT };

const { env, service, resolveIdentity, verifyWallet } = vi.hoisted(() => ({
    env: { prod: false },
    service: { find: vi.fn(), link: vi.fn(), unlink: vi.fn() },
    resolveIdentity: vi.fn(),
    verifyWallet: vi.fn(),
}));

vi.mock("@frak-labs/app-essentials", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@frak-labs/app-essentials")>()),
    get isRunningInProd() {
        return env.prod;
    },
}));
vi.mock("../../../../src/infrastructure/external/jwt", () => ({
    JwtContext: { wallet: { verify: verifyWallet } },
}));
vi.mock("../../../../src/domain/instagram/context", () => ({
    InstagramContext: { services: { instagramLink: service } },
}));
vi.mock("../../../../src/orchestration/context", () => ({
    OrchestrationContext: {
        orchestrators: { identity: { resolve: resolveIdentity } },
    },
}));

import { instagramRoutes } from "../../../../src/api/user/wallet/instagram";

function call(
    path: string,
    init: { method?: string; body?: unknown; auth?: boolean } = {}
) {
    return instagramRoutes.handle(
        new Request(`http://localhost/instagram${path}`, {
            method: init.method ?? "GET",
            headers: {
                "Content-Type": "application/json",
                ...(init.auth === false ? {} : { "x-wallet-auth": "jwt" }),
            },
            body:
                init.body === undefined ? undefined : JSON.stringify(init.body),
        })
    );
}

describe("Instagram wallet routes", () => {
    beforeEach(() => {
        env.prod = false;
        verifyWallet.mockResolvedValue({
            address: "0x0000000000000000000000000000000000000001",
        });
        resolveIdentity.mockResolvedValue({ groupId: GROUP });
    });

    describe("GET /instagram", () => {
        it("answers 401 without a wallet token", async () => {
            const response = await call("", { auth: false });

            expect(response.status).toBe(401);
            expect(service.find).not.toHaveBeenCalled();
        });

        it("returns the link of the caller's identity group", async () => {
            service.find.mockResolvedValue(LINK);

            const response = await call("");

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({
                link: { ...LINK, checkedAt: CHECKED_AT.toISOString() },
            });
            expect(service.find).toHaveBeenCalledWith(GROUP);
        });

        it("returns a null link when nothing is linked", async () => {
            service.find.mockResolvedValue(null);

            const response = await call("");

            expect(await response.json()).toEqual({ link: null });
        });

        it("keeps answering in production", async () => {
            env.prod = true;
            service.find.mockResolvedValue(null);

            expect((await call("")).status).toBe(200);
        });
    });

    describe("PUT /instagram/mock", () => {
        it("links a normalized handle under a mock igsid", async () => {
            service.link.mockResolvedValue(LINK);

            const response = await call("/mock", {
                method: "PUT",
                body: { username: "@Frak_FR", follows: true },
            });

            expect(response.status).toBe(200);
            expect(service.link).toHaveBeenCalledWith({
                identityGroupId: GROUP,
                igsid: "mock_frak_fr",
                username: "frak_fr",
                follows: true,
            });
        });

        it("answers 400 for a malformed handle", async () => {
            const response = await call("/mock", {
                method: "PUT",
                body: { username: "not a handle", follows: true },
            });

            expect(response.status).toBe(400);
            expect(await response.json()).toMatchObject({
                code: "INVALID_INSTAGRAM_HANDLE",
            });
            expect(service.link).not.toHaveBeenCalled();
        });

        it("answers 422 when the follow state is missing", async () => {
            const response = await call("/mock", {
                method: "PUT",
                body: { username: "frak_fr" },
            });

            expect(response.status).toBe(422);
            expect(service.link).not.toHaveBeenCalled();
        });

        it("passes the 409 of an account held by another wallet through", async () => {
            service.link.mockRejectedValue(
                HttpError.conflict("INSTAGRAM_ALREADY_LINKED", "taken")
            );

            const response = await call("/mock", {
                method: "PUT",
                body: { username: "frak_fr", follows: false },
            });

            expect(response.status).toBe(409);
            expect(await response.json()).toMatchObject({
                code: "INSTAGRAM_ALREADY_LINKED",
            });
        });
    });

    describe("DELETE /instagram/mock", () => {
        it("revokes the link of the caller's identity group", async () => {
            const response = await call("/mock", { method: "DELETE" });

            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ link: null });
            expect(service.unlink).toHaveBeenCalledWith(GROUP);
        });
    });

    describe("in production", () => {
        beforeEach(() => {
            env.prod = true;
        });

        it.each([
            ["PUT", { username: "frak_fr", follows: true }],
            ["DELETE", undefined],
        ])(
            "answers 404 to %s without touching the link",
            async (method, body) => {
                const response = await call("/mock", { method, body });

                expect(response.status).toBe(404);
                expect(service.link).not.toHaveBeenCalled();
                expect(service.unlink).not.toHaveBeenCalled();
            }
        );

        it("answers 404 rather than 401 to an unauthenticated caller", async () => {
            const response = await call("/mock", {
                method: "DELETE",
                auth: false,
            });

            expect(response.status).toBe(404);
        });
    });
});
