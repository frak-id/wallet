import { useQuery } from "@tanstack/react-query";
import { frakGame } from "@/module/game/config";

export type GameTickets = {
    /** Stored tickets, counted even while the user is not eligible. */
    tickets: number;
    /** Instagram linked and following @frak_fr: only then do tickets count in the draw. */
    eligible: boolean;
};

/** The caller's tickets for the open game. */
export function useGameTickets(gameId?: string) {
    return useQuery({
        queryKey: ["game", "tickets", gameId],
        // shortcut: mocked until FRA-368 serves the ticket ledger; swap this queryFn for the endpoint.
        queryFn: async (): Promise<GameTickets> => ({
            tickets: 1,
            eligible: false,
        }),
        enabled: frakGame.enabled && !!gameId,
    });
}
