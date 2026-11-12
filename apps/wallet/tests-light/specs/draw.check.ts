import type { Page } from "@playwright/test";
import {
    REJECTED_DRAW_FRAUD,
    REJECTED_DRAW_WINNER,
    rejectedPublicDraw,
} from "../../tests/gameFixtures";
import { expect, test } from "../fixtures";

/** Checks for the wallet `/draw` route: the public record of a game's draw. */

const GAME_ID = "5b0a6c1e-6a52-4b1c-9d3e-0f6f2d9a7c11";
const PID_A = "a1".repeat(16);
const PID_C = "c3".repeat(16);
const CHAIN_HASH = "52db9ba7".repeat(8);

const draw = {
    gameId: GAME_ID,
    algorithm: "frak-draw-v2",
    status: "drawn",
    frozenAt: "2026-10-10T19:00:00.000Z",
    snapshotRoot: "ab".repeat(32),
    totalTickets: 80,
    participants: 3,
    discardedParticipants: 1,
    entries: [
        { pid: PID_A, tickets: 20 },
        { pid: "b2".repeat(16), tickets: 10 },
        { pid: PID_C, tickets: 50 },
    ],
    drand: {
        chainHash: CHAIN_HASH,
        round: 1234,
        roundTime: "2026-10-10T19:10:00.000Z",
        signature: "cd".repeat(48),
        randomness: "ef".repeat(32),
    },
    candidates: [PID_C, PID_A],
    rejections: [],
    winnerPid: null,
    payoutTxHash: null,
};

async function mockDraw(page: Page, status = 200, body: unknown = draw) {
    await page.route("**/common/game/*/draw", (route) =>
        route.fulfill({
            status,
            contentType: status === 200 ? "application/json" : "text/plain",
            body: typeof body === "string" ? body : JSON.stringify(body),
        })
    );
}

const drawUrl = (params: Record<string, string> = { game: GAME_ID }) =>
    `/draw?${new URLSearchParams(params)}`;

test.describe("Draw page", () => {
    // The detector reads `navigator.language`; the assertions are in French.
    test.use({ locale: "fr-FR" });

    test("summarises the draw at phone width", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await mockDraw(page);
        await page.goto(drawUrl());

        await expect(
            page.getByRole("heading", { level: 1, name: "Tirage du Jeu Frak" })
        ).toBeVisible();
        await expect(
            page.getByText("Le tirage a eu lieu. On vérifie le gagnant.")
        ).toBeVisible();
        await expect(page.getByRole("main")).toHaveCount(1);
        await expect(page.getByText("Tour 1234")).toBeVisible();
        await expect(page.getByText("Toi dans le tirage")).toHaveCount(0);
        await expect(
            page.getByRole("link", {
                name: "Voir le nombre aléatoire chez drand",
            })
        ).toHaveAttribute(
            "href",
            `https://api.drand.sh/${CHAIN_HASH}/public/1234`
        );

        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth
        );
        expect(overflow).toBe(false);
    });

    test("shows where the player stands", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await mockDraw(page);
        await page.goto(drawUrl({ game: GAME_ID, pid: PID_A }));

        const card = page.locator("div", {
            has: page.getByRole("heading", { name: "Toi dans le tirage" }),
        });
        await expect(card.last()).toContainText("20");
        await expect(card.last()).toContainText("25 %");
        await expect(card.last()).toContainText("n° 2");
        await expect(card.last()).toContainText("a1a1a1…a1a1");
    });

    test("explains the candidates passed over before the winner", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await mockDraw(page, 200, rejectedPublicDraw());
        await page.goto(drawUrl({ game: GAME_ID, pid: REJECTED_DRAW_WINNER }));

        await expect(page.getByText("Tu as gagné !")).toBeVisible();
        await expect(
            page.getByText("Les 3 joueurs classés avant toi ont été écartés.")
        ).toBeVisible();
        await expect(
            page.getByRole("heading", { name: "Joueurs écartés" })
        ).toBeVisible();
        for (const reason of ["Fraude", "Injoignable", "Non éligible"]) {
            await expect(page.getByText(reason, { exact: true })).toBeVisible();
        }

        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth
        );
        expect(overflow).toBe(false);
    });

    test("tells a rejected player they were rejected, not why", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await mockDraw(page, 200, rejectedPublicDraw());
        await page.goto(drawUrl({ game: GAME_ID, pid: REJECTED_DRAW_FRAUD }));

        await expect(
            page.getByText("Tu as été tiré au sort, mais tu as été écarté.")
        ).toBeVisible();
        await expect(page.getByText("Écarté", { exact: true })).toBeVisible();
        await expect(page.getByText("Fraude", { exact: true })).toHaveCount(0);
        await expect(
            page.getByText("Injoignable", { exact: true })
        ).toBeVisible();
    });

    test("says so when the pid is not in the draw", async ({ page }) => {
        await mockDraw(page);
        await page.goto(drawUrl({ game: GAME_ID, pid: "ff".repeat(16) }));

        await expect(
            page.getByText(/Ton identifiant n'est pas dans ce tirage/)
        ).toBeVisible();
    });

    test("explains a draw that has not happened yet", async ({ page }) => {
        await mockDraw(page, 404, "Not drawn yet");
        await page.goto(drawUrl());

        await expect(page.getByText("Pas encore de tirage")).toBeVisible();
    });

    test("explains a link without a game", async ({ page }) => {
        await page.goto("/draw");

        await expect(page.getByText("Lien de tirage invalide")).toBeVisible();
    });
});
