import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { trackEvent } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useConfettiBurst } from "@/module/game/hook/useConfettiBurst";
import {
    type GameResult,
    useGameHistory,
} from "@/module/game/hook/useGameHistory";
import { gameWinStore } from "@/module/game/stores/gameWinStore";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import { useCoverNativeChrome } from "@/module/native-glass/hook/useOverlayOpen";
import * as styles from "./index.css";

/** A device that first opens the wallet later than this skips the celebration. */
export const WIN_SCREEN_MS = 30 * 24 * 60 * 60 * 1000;

function isFreshWin(result: GameResult, celebrated: Record<string, true>) {
    return (
        result.outcome === "won" &&
        result.confirmedAt !== null &&
        Date.now() - new Date(result.confirmedAt).getTime() < WIN_SCREEN_MS &&
        !celebrated[result.game.id]
    );
}

/** Celebrates a confirmed win once per device, over whatever screen the wallet opened on. */
export function GameWinScreen() {
    const { data } = useGameHistory();
    const celebrated = gameWinStore((s) => s.celebrated);
    const win = data?.find((result) => isFreshWin(result, celebrated));
    return win ? <WinScreen result={win} /> : null;
}

function WinScreen({ result }: { result: GameResult }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const markCelebrated = gameWinStore((s) => s.markCelebrated);
    const gameId = result.game.id;
    const prizeAmount = result.game.prizeAmount;
    const prize = formatGameAmount(prizeAmount, i18n.language);
    useConfettiBurst();
    useCoverNativeChrome("full");

    useEffect(() => {
        trackEvent("game_win_screen_viewed", {
            game_id: gameId,
            prize_amount: prizeAmount,
        });
    }, [gameId, prizeAmount]);

    const close = (action: "history" | "close") => {
        trackEvent("game_win_screen_closed", { game_id: gameId, action });
        markCelebrated(gameId);
        if (action === "history") navigate({ to: "/history" });
    };

    return (
        <Box
            className={styles.screen}
            role="dialog"
            aria-modal="true"
            aria-label={t("game.win.title")}
        >
            <Box className={styles.body}>
                <Text variant="display1" as="p" className={styles.amount}>
                    {prize}
                </Text>
                <Text variant="heading1" as="h2">
                    {t("game.win.title")}
                </Text>
                <Text color="secondary">
                    {t("game.win.description", { prize })}
                </Text>
            </Box>
            <Box className={styles.actions}>
                <Button onClick={() => close("history")}>
                    {t("game.win.cta")}
                </Button>
                <Button variant="secondary" onClick={() => close("close")}>
                    {t("game.win.close")}
                </Button>
            </Box>
        </Box>
    );
}
