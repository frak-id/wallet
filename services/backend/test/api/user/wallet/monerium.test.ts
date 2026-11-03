import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../../src/utils/httpError";
import { JwtContextMock } from "../../../mock/common";
import { WALLET } from "../../../mock/monerium";

const { services } = vi.hoisted(() => ({
    services: {
        auth: {
            start: vi.fn(),
            handleCallback: vi.fn(),
            prepareSiwe: vi.fn(),
            submitSiwe: vi.fn(),
            disconnect: vi.fn(),
        },
        status: { getStatus: vi.fn() },
        link: { linkWallet: vi.fn() },
        orders: {
            placeOrder: vi.fn(),
            listOrders: vi.fn(),
            listBeneficiaries: vi.fn(),
        },
    },
}));

vi.mock("../../../../src/domain/monerium", () => ({
    MoneriumContext: { services },
}));

import { moneriumRoutes } from "../../../../src/api/user/wallet/monerium";

const NO_CONNECTION = {
    connection: "none",
    profile: null,
    walletLink: "none",
    silentReconnect: false,
    environment: "sandbox",
} as const;

function call(path: string, init: { method?: string; body?: unknown } = {}) {
    return moneriumRoutes.handle(
        new Request(`http://localhost/monerium${path}`, {
            method: init.method ?? "GET",
            headers: {
                "Content-Type": "application/json",
                "x-wallet-auth": "wallet-jwt",
            },
            body:
                init.body === undefined ? undefined : JSON.stringify(init.body),
        })
    );
}

describe("Monerium wallet routes", () => {
    beforeEach(() => {
        JwtContextMock.wallet.verify.mockResolvedValue({
            address: WALLET,
        } as never);
    });
    afterEach(() => {
        JwtContextMock.wallet.verify.mockResolvedValue({ wallet: "0x123" });
    });

    it("answers 401 without a wallet token", async () => {
        const response = await moneriumRoutes.handle(
            new Request("http://localhost/monerium/status")
        );
        expect(response.status).toBe(401);
        expect(services.status.getStatus).not.toHaveBeenCalled();
    });

    it("hands the session wallet to the service", async () => {
        services.status.getStatus.mockResolvedValue(NO_CONNECTION);

        const response = await call("/status");

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(NO_CONNECTION);
        expect(services.status.getStatus).toHaveBeenCalledWith(WALLET, {
            refresh: false,
        });
    });

    it.each([
        [
            "a state over 64 characters",
            "/auth/callback",
            { code: "c", state: "s".repeat(65) },
        ],
        [
            "a code over 512 characters",
            "/auth/callback",
            { code: "c".repeat(513), state: "s" },
        ],
        [
            "a SIWE signature over 16384 characters",
            "/auth/siwe",
            { state: "s", signature: `0x${"a".repeat(16_385)}` },
        ],
        [
            "a link signature over 16384 characters",
            "/wallet/link",
            { signature: `0x${"a".repeat(16_385)}` },
        ],
    ])(
        "answers 422 for %s without calling a service",
        async (_name, path, body) => {
            const response = await call(path, { method: "POST", body });

            expect(response.status).toBe(422);
            expect(services.auth.handleCallback).not.toHaveBeenCalled();
            expect(services.auth.submitSiwe).not.toHaveBeenCalled();
            expect(services.link.linkWallet).not.toHaveBeenCalled();
        }
    );

    it("serializes a service HttpError with its code in the body", async () => {
        services.orders.listOrders.mockRejectedValue(
            HttpError.conflict("MONERIUM_REAUTH_REQUIRED", "Sign in again")
        );

        const response = await call("/orders");

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({
            success: false,
            code: "MONERIUM_REAUTH_REQUIRED",
            error: "Sign in again",
        });
    });
});
