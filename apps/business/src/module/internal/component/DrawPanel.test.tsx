import type {
    GameAdmin,
    GameDrawAdmin,
} from "@frak-labs/backend-elysia/orchestration/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "en" },
    }),
}));

vi.mock("@tanstack/react-router", () => ({
    Link: ({ children }: { children: React.ReactNode }) => (
        <a href="/">{children}</a>
    ),
}));

const mutation = { mutate: vi.fn(), isPending: false, error: null };
let draw: GameDrawAdmin | null;
vi.mock("../api", () => ({
    gameDrawQueryOptions: (gameId: string) => ({
        queryKey: ["draw", gameId],
        queryFn: async () => draw,
    }),
    drawVerificationQueryOptions: (gameId: string) => ({
        queryKey: ["verify", gameId],
        queryFn: async () => [],
    }),
    publicDrawUrl: () => "https://backend/common/game/g/draw",
    useFreezeDraw: () => mutation,
    useRejectCandidate: () => mutation,
    useConfirmWinner: () => mutation,
}));

import { DrawPanel } from "./DrawPanel";

const NO_TICKETS = {
    join: 1,
    instagramCertified: 0,
    purchase: 0,
    referredPurchase: 0,
    referredSignup: 0,
    brandShare: 0,
};

const game = { id: "g", status: "active" } as GameAdmin;

function drawn(awaiting: "admin" | "player"): GameDrawAdmin {
    return {
        status: "drawn",
        algorithm: "frak-draw-v2",
        frozenAt: new Date(),
        snapshotRoot: "ab".repeat(32),
        totalTickets: 12,
        participants: 4,
        eligibleParticipants: 3,
        drand: { round: 1, roundTime: new Date(), signed: true },
        candidates: 3,
        candidateWindow: true,
        rejections: [],
        winner: null,
        candidate: {
            rank: 0,
            pid: "pid-1",
            identityGroupId: "group-1",
            wallet: null,
            accountCreatedAt: null,
            instagram: {
                level: awaiting === "admin" ? "certified" : "declared",
                username: "bob",
                follows: awaiting === "admin" ? true : null,
                checkedAt: null,
                followFresh: true,
            },
            awaiting,
            verifyBy: null,
            drawTickets: 1,
            tickets: NO_TICKETS,
        },
    };
}

async function renderPanel(value: GameDrawAdmin | null) {
    draw = value;
    render(
        <QueryClientProvider client={new QueryClient()}>
            <DrawPanel game={game} />
        </QueryClientProvider>
    );
}

const payButton = () =>
    screen.findByRole("button", { name: "internal.draw.confirm.trigger" });

describe("DrawPanel", () => {
    it("offers to freeze an ended game the cron has not frozen", async () => {
        await renderPanel(null);
        expect(
            await screen.findByRole("button", {
                name: "internal.draw.freeze.trigger",
            })
        ).toBeInTheDocument();
    });

    it("keeps the payout locked while the candidate still has to certify", async () => {
        await renderPanel(drawn("player"));
        expect(await payButton()).toBeDisabled();
        expect(
            screen.getByText("internal.draw.candidate.awaitingPlayer")
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "internal.draw.reject.trigger" })
        ).toBeEnabled();
    });

    it("lets the admin pay a certified follower", async () => {
        await renderPanel(drawn("admin"));
        expect(await payButton()).toBeEnabled();
    });

    it("points at the bank when the prize waits on funds", async () => {
        await renderPanel({
            ...drawn("admin"),
            status: "confirmed",
            candidate: null,
            winner: {
                identityGroupId: "group-1",
                wallet: null,
                confirmedBy: "admin@frak.id",
                confirmedAt: new Date(),
                assetLogId: "asset-1",
                payout: {
                    status: "bank_depleted",
                    amount: "50",
                    txHash: null,
                    statusChangedAt: new Date(),
                    settledAt: null,
                    expiresAt: null,
                    lastError: null,
                },
            },
        });
        expect(
            await screen.findByText("internal.payout.status.bank_depleted")
        ).toBeInTheDocument();
        expect(
            screen.getByText("internal.draw.winner.openBank")
        ).toBeInTheDocument();
    });
});
