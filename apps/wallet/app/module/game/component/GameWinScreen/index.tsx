import type { GameResult } from "@frak-labs/backend-elysia/domain/game/schemas";
import { trackEvent } from "@frak-labs/wallet-shared";
import { useEffect } from "react";
import { useGameHistory } from "@/module/game/hook/useGameHistory";
import { gameWinStore } from "@/module/game/stores/gameWinStore";
import { modalStore } from "@/module/stores/modalStore";

/** A device that first opens the wallet later than this skips the celebration. */
const WIN_SCREEN_MS = 30 * 24 * 60 * 60 * 1000;

function isFreshWin(result: GameResult, celebrated: Record<string, true>) {
    return (
        result.outcome === "won" &&
        result.confirmedAt !== null &&
        Date.now() - new Date(result.confirmedAt).getTime() < WIN_SCREEN_MS &&
        !celebrated[result.game.id]
    );
}

/** Opens the win celebration once per device, over whatever screen the wallet opened on. */
export function GameWinScreen() {
    const { data } = useGameHistory();
    const celebrated = gameWinStore((s) => s.celebrated);
    const win = data?.find((result) => isFreshWin(result, celebrated));

    useEffect(() => {
        if (!win) return;
        const store = gameWinStore.getState();
        // Read fresh, not from the render: a re-run must not open the same win twice.
        if (store.celebrated[win.game.id]) return;
        store.markCelebrated(win.game.id);
        trackEvent("game_win_screen_viewed", {
            game_id: win.game.id,
            prize_amount: win.game.prizeAmount,
        });
        modalStore.getState().openModal({ id: "gameWin", result: win });
    }, [win]);

    return null;
}
