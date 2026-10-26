import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useNavigate } from "@tanstack/react-router";
import { GlassCloseButton } from "@/module/common/component/GlassCloseButton";
import {
    GameResultDetail,
    OutcomeHero,
} from "@/module/game/component/GameResult";
import type { GameResult } from "@/module/game/hook/useGameHistory";
import { modalStore } from "@/module/stores/modalStore";
import * as styles from "./index.css";

/** A past game's result, opened from its row in the past games list. */
export function GameResultSheet({
    result,
    onClose,
}: {
    result: GameResult;
    onClose: () => void;
}) {
    const navigate = useNavigate();
    const seePrize = () => {
        modalStore.getState().dismissAll();
        void navigate({ to: "/history" });
    };

    return (
        <Box className={styles.sheet}>
            <Box className={styles.header}>
                <GlassCloseButton onClick={onClose} />
            </Box>
            <Stack space="m">
                <OutcomeHero result={result} />
                <GameResultDetail result={result} onSeePrize={seePrize} />
            </Stack>
        </Box>
    );
}
