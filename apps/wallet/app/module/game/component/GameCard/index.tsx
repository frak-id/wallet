import type { GameResult } from "@frak-labs/backend-elysia/domain/game/schemas";
import { Badge } from "@frak-labs/design-system/components/Badge";
import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Text } from "@frak-labs/design-system/components/Text";
import { ChevronRightIcon } from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import { Ticket } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { OutcomeBadge } from "@/module/game/component/GameResult";
import { useCurrentGame } from "@/module/game/hook/useCurrentGame";
import { useGameHistory } from "@/module/game/hook/useGameHistory";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import { formatGameEnd } from "@/module/game/utils/formatGameDate";
import * as styles from "@/module/wallet/component/AddEmailCard/index.css";

/** How long after its end a game's result stays on the wallet home. */
const RESULT_CARD_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Wallet-home recap: a draw waiting on the user first (straight to certifying),
 * then the open game, or the last game played when it ended recently; hidden otherwise.
 */
export function GameCard() {
    const { t, i18n } = useTranslation();
    const { data } = useCurrentGame();
    const history = useGameHistory();
    const pending = history.data?.find(
        (result) => result.outcome === "pending_verification"
    );

    if (pending) {
        return (
            <GameCardShell
                to="/profile/instagram"
                title={t("game.card.drawn")}
                prize={pending.game}
                detail={
                    pending.verifyBy
                        ? t("game.card.verifyBy", {
                              date: formatGameEnd(
                                  pending.verifyBy,
                                  i18n.language
                              ),
                          })
                        : undefined
                }
                badge={<OutcomeBadge outcome={pending.outcome} />}
            />
        );
    }

    if (data?.game) {
        return (
            <OpenGameCard
                game={data.game}
                participating={data.me.participating}
            />
        );
    }

    const latest = data && history.data?.[0];
    if (!(latest && isRecent(latest))) return null;
    return (
        <GameCardShell
            to="/game"
            title={t("game.card.ended")}
            prize={latest.game}
            badge={<OutcomeBadge outcome={latest.outcome} />}
        />
    );
}

/** The open game, leading to its page once joined and to the code screen before. */
export function OpenGameCard({
    game,
    participating,
}: {
    game: { prizeAmount: number; prizeDescription: string | null };
    participating: boolean;
}) {
    const { t } = useTranslation();
    return (
        <GameCardShell
            to={participating ? "/game" : "/game/join"}
            title={t("game.card.title")}
            prize={game}
            badge={
                <Badge
                    size="small"
                    variant={participating ? "success" : "neutral"}
                >
                    {participating
                        ? t("game.card.participating")
                        : t("game.card.notParticipating")}
                </Badge>
            }
        />
    );
}

function isRecent(result: GameResult) {
    return Date.now() - new Date(result.game.endsAt).getTime() < RESULT_CARD_MS;
}

function GameCardShell({
    to,
    title,
    prize,
    detail,
    badge,
}: {
    to: "/game" | "/game/join" | "/profile/instagram";
    title: string;
    prize: { prizeAmount: number; prizeDescription: string | null };
    /** Replaces the prize line. */
    detail?: string;
    badge: ReactNode;
}) {
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const open = () => navigate({ to });
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        open();
    };

    return (
        <Card
            padding="none"
            className={styles.card}
            role="button"
            tabIndex={0}
            onClick={open}
            onKeyDown={handleKeyDown}
        >
            <Box className={styles.layoutRow}>
                <Box className={styles.iconBubble}>
                    <Ticket size={20} />
                </Box>
                <Box className={styles.textBlock}>
                    <Text variant="body" weight="semiBold">
                        {title}
                    </Text>
                    <Text variant="caption" color="secondary">
                        {detail ??
                            prize.prizeDescription ??
                            formatGameAmount(prize.prizeAmount, i18n.language)}
                    </Text>
                    <Box>{badge}</Box>
                </Box>
                <Box className={styles.chevron}>
                    <ChevronRightIcon width={16} height={16} />
                </Box>
            </Box>
        </Card>
    );
}
