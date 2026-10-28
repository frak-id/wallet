import { beforeEach, describe, expect, it, vi } from "vitest";

const { frakCodeAdmin, frakGameAdmin, gameDraw, identityLookup } = vi.hoisted(
    () => ({
        frakCodeAdmin: {
            list: vi.fn(async () => []),
            issue: vi.fn(async () => ({ id: "c1", code: "FRAK26" })),
            revoke: vi.fn(async () => ({ id: "c1", code: "FRAK26" })),
        },
        frakGameAdmin: {
            setup: vi.fn(async () => ({ merchant: null, signupRules: [] })),
            seedMerchant: vi.fn(async () => ({
                merchant: { id: "m1", domain: "frak.id" },
                created: true,
            })),
            publishSignupRule: vi.fn(async () => ({ id: "r1" })),
            listGames: vi.fn(async () => []),
            createGame: vi.fn(async () => ({ id: "g1" })),
            setStatus: vi.fn(async () => ({ status: "paused" })),
            playersOf: vi.fn(async () => ({
                source: "live",
                computedAt: new Date(),
                players: [],
            })),
            drawOf: vi.fn(async () => null),
            verifyDraw: vi.fn(async () => []),
            freeze: vi.fn(async () => ({ status: "frozen" })),
        },
        gameDraw: {
            runDue: vi.fn(async () => ({ frozen: 0, drawn: 0, advanced: 0 })),
            reject: vi.fn(async () => ({ status: "drawn" })),
            confirm: vi.fn(async () => ({ status: "confirmed" })),
        },
        identityLookup: { lookup: vi.fn(async () => null) },
    })
);

vi.mock("../../../src/orchestration/context", () => ({
    OrchestrationContext: {
        orchestrators: {
            frakCodeAdmin,
            frakGameAdmin,
            gameDraw,
            identityLookup,
        },
    },
}));

vi.mock("../../../src/domain/merchant", () => ({
    MerchantContext: {
        repositories: {
            dnsCheck: {
                getNormalizedDomain: (domain: string) =>
                    domain.replace("https://www.", ""),
            },
        },
    },
}));

vi.mock("../../../src/domain/business-auth", () => ({
    BusinessAuthContext: { repositories: { account: { findById: vi.fn() } } },
}));

import { internalRoutes } from "../../../src/api/business/internal";
import {
    resetMockBusinessSession,
    setMockBusinessSession,
    setMockPlatformAdmin,
    setMockStepUpFresh,
} from "../../mock/common";

const ADMIN_WALLET = "0x1111111111111111111111111111111111111111";
const GAME = "33333333-3333-4333-8333-333333333333";

type Route = { method: "GET" | "POST"; path: string; body?: object };

const MONEY_ROUTES: Route[] = [
    {
        method: "POST",
        path: "/internal/game/setup/signup-rule",
        body: { referrer: 2, referee: 1, budget: 100 },
    },
    {
        method: "POST",
        path: "/internal/game",
        body: {
            code: "FRAK26",
            reward: 2,
            budget: 500,
            startsAt: "2026-11-02T00:00:00Z",
            endsAt: "2026-11-09T00:00:00Z",
            prizeAmount: 50,
        },
    },
    { method: "POST", path: `/internal/game/${GAME}/draw/confirm` },
];

const OTHER_ROUTES: Route[] = [
    { method: "GET", path: "/internal/referral-codes" },
    { method: "POST", path: "/internal/referral-codes", body: {} },
    { method: "POST", path: "/internal/referral-codes/FRAK26/revoke" },
    { method: "GET", path: "/internal/game/setup" },
    {
        method: "POST",
        path: "/internal/game/setup/merchant",
        body: { domain: "frak.id" },
    },
    { method: "GET", path: "/internal/game" },
    { method: "POST", path: "/internal/game/run-draws" },
    {
        method: "POST",
        path: `/internal/game/${GAME}/status`,
        body: { status: "paused" },
    },
    { method: "GET", path: `/internal/game/${GAME}/players` },
    { method: "GET", path: `/internal/game/${GAME}/draw` },
    { method: "GET", path: `/internal/game/${GAME}/draw/verify` },
    { method: "POST", path: `/internal/game/${GAME}/draw/freeze` },
    {
        method: "POST",
        path: `/internal/game/${GAME}/draw/reject`,
        body: { reason: "fraud" },
    },
    { method: "POST", path: "/internal/lookup", body: { q: ADMIN_WALLET } },
    {
        method: "POST",
        path: "/internal/setup-code",
        body: { domain: "shop.com", owner: "owner@shop.com" },
    },
];

const ALL_ROUTES = [...MONEY_ROUTES, ...OTHER_ROUTES];

function call({ method, path, body }: Route, token?: string) {
    return internalRoutes.handle(
        new Request(`http://localhost${path}`, {
            method,
            headers: {
                ...(body ? { "Content-Type": "application/json" } : {}),
                ...(token ? { "x-business-auth": token } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        })
    );
}

function callAsAdmin(route: Route) {
    setMockBusinessSession({ wallet: ADMIN_WALLET });
    setMockPlatformAdmin(true);
    return call(route, "token");
}

const label = ({ method, path }: Route) => `${method} ${path}`;

describe("internal routes", () => {
    beforeEach(() => {
        resetMockBusinessSession();
        setMockPlatformAdmin(false);
        setMockStepUpFresh(true);
    });

    it.each(ALL_ROUTES.map((route) => [label(route), route] as const))(
        "401s %s without a session",
        async (_, route) => {
            expect((await call(route)).status).toBe(401);
        }
    );

    it.each(ALL_ROUTES.map((route) => [label(route), route] as const))(
        "403s %s for a merchant who is not a platform admin",
        async (_, route) => {
            setMockBusinessSession({ wallet: ADMIN_WALLET });
            expect((await call(route, "token")).status).toBe(403);
        }
    );

    it.each(MONEY_ROUTES.map((route) => [label(route), route] as const))(
        "asks a fresh 2FA before %s",
        async (_, route) => {
            setMockStepUpFresh(false);
            expect((await callAsAdmin(route)).status).toBe(401);
        }
    );

    it.each(OTHER_ROUTES.map((route) => [label(route), route] as const))(
        "lets %s through without a fresh 2FA",
        async (_, route) => {
            setMockStepUpFresh(false);
            expect((await callAsAdmin(route)).status).not.toBe(401);
        }
    );

    it("hands the game window to the orchestrator as dates", async () => {
        const create = MONEY_ROUTES.find((r) => r.path === "/internal/game");
        if (!create) throw new Error("no create route");
        expect((await callAsAdmin(create)).status).toBe(200);
        expect(frakGameAdmin.createGame).toHaveBeenCalledWith(
            expect.objectContaining({
                startsAt: new Date("2026-11-02T00:00:00Z"),
                endsAt: new Date("2026-11-09T00:00:00Z"),
            })
        );
    });

    it("records the reviewing admin on a rejection", async () => {
        const reject = OTHER_ROUTES.find((r) => r.path.endsWith("/reject"));
        if (!reject) throw new Error("no reject route");
        expect((await callAsAdmin(reject)).status).toBe(200);
        expect(gameDraw.reject).toHaveBeenCalledWith(
            GAME,
            "fraud",
            ADMIN_WALLET
        );
    });

    it("makes the acting admin the Frak merchant's owner by default", async () => {
        await callAsAdmin({
            method: "POST",
            path: "/internal/game/setup/merchant",
            body: { domain: "frak.id" },
        });
        expect(frakGameAdmin.seedMerchant).toHaveBeenCalledWith({
            domain: "frak.id",
            owner: { wallet: ADMIN_WALLET },
        });
    });

    it("issues a setup code for the normalized domain", async () => {
        const response = await callAsAdmin({
            method: "POST",
            path: "/internal/setup-code",
            body: { domain: "https://www.shop.com", owner: "owner@shop.com" },
        });
        const body = await response.json();
        expect(body.domain).toBe("shop.com");
        expect(body.setupCode).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("400s a setup code for an owner that is neither a wallet nor an email", async () => {
        const response = await callAsAdmin({
            method: "POST",
            path: "/internal/setup-code",
            body: { domain: "shop.com", owner: "someone" },
        });
        expect(response.status).toBe(400);
    });

    it("404s a lookup that matches nobody", async () => {
        const response = await callAsAdmin({
            method: "POST",
            path: "/internal/lookup",
            body: { q: ADMIN_WALLET },
        });
        expect(response.status).toBe(404);
    });
});
