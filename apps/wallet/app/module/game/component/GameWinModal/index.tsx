import type { GameResult } from "@frak-labs/backend-elysia/domain/game/schemas";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { trackEvent } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useConfettiBurst } from "@/module/game/hook/useConfettiBurst";
import { celebrationAmount } from "@/module/game/styles/celebration.css";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import { modalStore } from "@/module/stores/modalStore";
import * as styles from "./index.css";

/** The full-screen celebration of a confirmed win, with the way to the prize. */
export function GameWinModal({
    result,
    onClose,
}: {
    result: GameResult;
    onClose: () => void;
}) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const gameId = result.game.id;
    const prize = formatGameAmount(result.game.prizeAmount, i18n.language);
    useConfettiBurst();

    const seePrize = () => {
        trackEvent("game_win_screen_closed", {
            game_id: gameId,
            action: "history",
        });
        modalStore.getState().dismissAll();
        void navigate({ to: "/history" });
    };
    const close = () => {
        trackEvent("game_win_screen_closed", {
            game_id: gameId,
            action: "close",
        });
        onClose();
    };

    return (
        <Box className={styles.screen}>
            <Box className={styles.body}>
                <Text variant="display1" as="p" className={celebrationAmount}>
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
                <Button onClick={seePrize}>{t("game.win.cta")}</Button>
                <Button variant="secondary" onClick={close}>
                    {t("game.win.close")}
                </Button>
            </Box>
        </Box>
    );
}
