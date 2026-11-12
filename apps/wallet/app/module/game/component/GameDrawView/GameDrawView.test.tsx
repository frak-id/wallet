import { translation } from "@frak-labs/wallet-shared/i18n/locales/fr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { publicDraw } from "@/tests/gameFixtures";
import { GameDrawView } from "./index";

const { getDraw } = vi.hoisted(() => ({ getDraw: vi.fn() }));

vi.mock("@frak-labs/wallet-shared/common/api/backendClient", () => ({
    backendUrl: "https://backend.test",
    authenticatedBackendApi: {
        common: { game: () => ({ draw: { get: getDraw } }) },
    },
}));

const GAME = "5b0a6c1e-6a52-4b1c-9d3e-0f6f2d9a7c11";
const A = "a1".repeat(16);
const C = "c3".repeat(16);

const i18n = i18next.createInstance();

beforeAll(async () => {
    await i18n.use(initReactI18next).init({
        lng: "fr",
        resources: { fr: { translation } },
        interpolation: { escapeValue: false },
    });
});

function renderView(props: { gameId?: string; pid?: string }) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={client}>
                <GameDrawView {...props} />
            </QueryClientProvider>
        </I18nextProvider>
    );
}

/** The draw as the API serves it: JSON, so dates are ISO strings. */
const respondWith = (draw: ReturnType<typeof publicDraw>) =>
    getDraw.mockResolvedValue({
        data: JSON.parse(JSON.stringify(draw)),
        error: null,
    });

describe("GameDrawView", () => {
    beforeEach(() => {
        getDraw.mockReset();
    });

    it("explains a link without a usable game", () => {
        renderView({});

        expect(screen.getByText("Lien de tirage invalide")).toBeInTheDocument();
        expect(getDraw).not.toHaveBeenCalled();
    });

    it("says the draw has not happened yet on a 404", async () => {
        getDraw.mockResolvedValue({ data: null, error: { status: 404 } });
        renderView({ gameId: GAME });

        expect(
            await screen.findByText("Pas encore de tirage")
        ).toBeInTheDocument();
    });

    it("offers a retry when the draw cannot be reached", async () => {
        getDraw.mockResolvedValueOnce({ data: null, error: { status: 503 } });
        renderView({ gameId: GAME });
        expect(
            await screen.findByText("Impossible de charger le tirage")
        ).toBeInTheDocument();

        respondWith(publicDraw());
        fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

        expect(
            await screen.findByText("Le tirage en chiffres")
        ).toBeInTheDocument();
    });

    it("shows a loading state before the record arrives", () => {
        getDraw.mockReturnValue(new Promise(() => {}));
        renderView({ gameId: GAME });

        expect(screen.getByRole("status")).toHaveTextContent(
            "Chargement du tirage…"
        );
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: "Tirage du Jeu Frak",
            })
        ).toBeInTheDocument();
    });

    it("summarises a draw whose winner is being checked", async () => {
        respondWith(publicDraw({ status: "drawn" }));
        renderView({ gameId: GAME });

        expect(
            await screen.findByText(
                "Le tirage a eu lieu. On vérifie le gagnant."
            )
        ).toBeInTheDocument();
        expect(screen.getByText("Tour 1234")).toBeInTheDocument();
        expect(screen.getByText("Pas encore connu")).toBeInTheDocument();
        expect(screen.queryByText("Toi dans le tirage")).toBeNull();
    });

    it("announces the date of a draw still scheduled and hides the drand link", async () => {
        const draw = publicDraw({ status: "frozen", candidates: [] });
        respondWith({
            ...draw,
            drand: {
                ...draw.drand,
                signature: null,
                randomness: null,
                roundTime: new Date(Date.now() + 3_600_000),
            },
        });
        renderView({ gameId: GAME });

        expect(
            await screen.findByText(/Le tirage aura lieu le/)
        ).toBeInTheDocument();
        expect(screen.getByText("Attendu le")).toBeInTheDocument();
        expect(
            screen.queryByText("Voir le nombre aléatoire chez drand")
        ).toBeNull();
    });

    it("says the draw is in progress once the round is out but the record is still frozen", async () => {
        const draw = publicDraw({ status: "frozen", candidates: [] });
        respondWith({
            ...draw,
            drand: {
                ...draw.drand,
                signature: null,
                randomness: null,
                roundTime: new Date(Date.now() - 60_000),
            },
        });
        renderView({ gameId: GAME });

        expect(
            await screen.findByText(
                "Le tirage est en cours. Le résultat arrive dans quelques minutes."
            )
        ).toBeInTheDocument();
        expect(screen.queryByText(/Le tirage aura lieu le/)).toBeNull();
    });

    it("shows the winner and the payout of a confirmed draw", async () => {
        respondWith(
            publicDraw({
                status: "confirmed",
                winnerPid: C,
                payoutTxHash: "0xabc",
            })
        );
        renderView({ gameId: GAME });

        expect(
            await screen.findByText("Le gagnant est confirmé.")
        ).toBeInTheDocument();
        expect(screen.getByText("c3c3c3…c3c3")).toBeInTheDocument();
        expect(screen.getByText("Versé")).toBeInTheDocument();
    });

    it("says nobody won a void draw", async () => {
        respondWith(publicDraw({ status: "void", candidates: [] }));
        renderView({ gameId: GAME });

        expect(
            await screen.findByText("Pas de gagnant pour ce jeu.")
        ).toBeInTheDocument();
        expect(screen.getByText("Aucun")).toBeInTheDocument();
    });

    it("links the raw record and the drand round, both safely external", async () => {
        respondWith(publicDraw());
        renderView({ gameId: GAME });

        const raw = await screen.findByRole("link", {
            name: "Voir les données brutes",
        });
        const drand = screen.getByRole("link", {
            name: "Voir le nombre aléatoire chez drand",
        });

        expect(raw).toHaveAttribute(
            "href",
            `https://backend.test/common/game/${GAME}/draw`
        );
        expect(drand).toHaveAttribute(
            "href",
            `https://api.drand.sh/${"52db9ba7".repeat(8)}/public/1234`
        );
        for (const link of [raw, drand]) {
            expect(link).toHaveAttribute("target", "_blank");
            expect(link.getAttribute("rel")).toContain("noreferrer");
        }
    });

    describe("with a pid", () => {
        it("shows the player's tickets, chance and rank", async () => {
            respondWith(publicDraw());
            renderView({ gameId: GAME, pid: A });

            expect(
                await screen.findByText("Toi dans le tirage")
            ).toBeInTheDocument();
            expect(screen.getByText("20")).toBeInTheDocument();
            expect(screen.getByText("25 %")).toBeInTheDocument();
            expect(screen.getByText("n° 2")).toBeInTheDocument();
            expect(screen.getByText("a1a1a1…a1a1")).toBeInTheDocument();
            expect(screen.queryByText("Tu as gagné !")).toBeNull();
        });

        it("congratulates the winner", async () => {
            respondWith(publicDraw({ status: "confirmed", winnerPid: C }));
            renderView({ gameId: GAME, pid: C });

            expect(
                await screen.findByText("Tu as gagné !")
            ).toBeInTheDocument();
        });

        it("says plainly when the pid is not in the draw", async () => {
            respondWith(publicDraw());
            renderView({ gameId: GAME, pid: "ff".repeat(16) });

            expect(
                await screen.findByText(
                    /Ton identifiant n'est pas dans ce tirage/
                )
            ).toBeInTheDocument();
            expect(screen.queryByText("Tes tickets")).toBeNull();
        });

        it("copies the full pid", async () => {
            const writeText = vi.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, "clipboard", {
                value: { writeText },
                configurable: true,
            });
            respondWith(publicDraw());
            renderView({ gameId: GAME, pid: A });

            const row = await screen.findByRole("button", {
                name: "Copier ton identifiant complet",
            });
            expect(row).toHaveTextContent("Ton identifiant");
            expect(row).toHaveTextContent("a1a1a1…a1a1");
            fireEvent.click(row);

            expect(writeText).toHaveBeenCalledWith(A);
            expect(
                screen.getByRole("button", { name: "Copié" })
            ).toBeInTheDocument();
        });
    });
});
