import type { GamePlayers } from "@frak-labs/backend-elysia/orchestration/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: "en" },
    }),
}));

vi.mock("@tanstack/react-router", () => ({
    Link: ({
        children,
        title,
    }: {
        children: React.ReactNode;
        title: string;
    }) => <a href={`/internal/lookup?q=${title}`}>{children}</a>,
}));

const NO_TICKETS = {
    join: 0,
    instagramCertified: 0,
    purchase: 0,
    referredPurchase: 0,
    referredSignup: 0,
    brandShare: 0,
};

let players: GamePlayers;
vi.mock("../api", () => ({
    LIVE_REFRESH_MS: 30_000,
    gamePlayersQueryOptions: (gameId: string) => ({
        queryKey: ["players", gameId],
        queryFn: async () => players,
    }),
    useRefreshPlayers: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { PlayersTable } from "./PlayersTable";

const buyer = {
    identityGroupId: "11111111-1111-4111-8111-111111111111",
    wallet: "0xb0b0000000000000000000000000000000000b0b",
    joinedAt: new Date("2026-10-30T10:00:00Z"),
    tickets: { ...NO_TICKETS, join: 1, instagramCertified: 2, purchase: 6 },
    totalTickets: 9,
    eligible: true,
    drawTickets: null,
    discarded: null,
    pid: null,
    instagram: { level: "certified" as const, username: "bob", follows: true },
};

const lurker = {
    ...buyer,
    identityGroupId: "22222222-2222-4222-8222-222222222222",
    wallet: null,
    tickets: { ...NO_TICKETS, join: 1 },
    totalTickets: 1,
    eligible: false,
    instagram: { level: "none" as const, username: null, follows: null },
};

async function renderTable(data: GamePlayers) {
    players = data;
    render(
        <QueryClientProvider client={new QueryClient()}>
            <Suspense fallback="loading">
                <PlayersTable gameId="game-1" />
            </Suspense>
        </QueryClientProvider>
    );
    await screen.findByText("internal.game.players.title");
}

describe("PlayersTable", () => {
    it("shows each player's tickets by source and whether they count", async () => {
        await renderTable({
            source: "live",
            computedAt: new Date(),
            players: [buyer, lurker],
        });

        expect(
            screen.getByText(
                "1 internal.tickets.join · 2 internal.tickets.instagramCertified · 6 internal.tickets.purchase"
            )
        ).toBeInTheDocument();
        expect(screen.getByText("@bob")).toBeInTheDocument();
        expect(
            screen.getByText("internal.game.players.counts")
        ).toBeInTheDocument();
        expect(
            screen.getByText("internal.game.players.wouldNotCount")
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", {
                name: "internal.game.players.refresh",
            })
        ).toBeInTheDocument();
    });

    it("filters by Instagram handle", async () => {
        await renderTable({
            source: "live",
            computedAt: new Date(),
            players: [buyer, lurker],
        });

        fireEvent.change(
            screen.getByRole("textbox", {
                name: "internal.game.players.search",
            }),
            { target: { value: "BOB" } }
        );

        expect(screen.getByText("@bob")).toBeInTheDocument();
        expect(screen.queryByText("internal.instagram.none")).toBeNull();
    });

    it("shows why a frozen player's tickets were thrown out, and offers no recount", async () => {
        await renderTable({
            source: "frozen",
            computedAt: new Date(),
            players: [
                {
                    ...lurker,
                    drawTickets: 0,
                    discarded: "not_linked",
                    pid: "abc",
                },
            ],
        });

        expect(
            screen.getByText("internal.draw.discarded.not_linked")
        ).toBeInTheDocument();
        expect(screen.getByText("1 → 0")).toBeInTheDocument();
        expect(
            screen.queryByRole("button", {
                name: "internal.game.players.refresh",
            })
        ).toBeNull();
    });
});
