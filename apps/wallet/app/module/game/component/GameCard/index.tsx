import { Badge } from "@frak-labs/design-system/components/Badge";
import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Text } from "@frak-labs/design-system/components/Text";
import { ChevronRightIcon } from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import { Ticket } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentDrop } from "@/module/game/hook/useCurrentDrop";
import * as styles from "@/module/wallet/component/AddEmailCard/index.css";

/** Wallet-home recap of the open game; hidden when there is none, while loading, or on error. */
export function GameCard() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { data: drop } = useCurrentDrop();

    if (!drop) return null;

    const open = () => navigate({ to: drop.joined ? "/game" : "/game/join" });
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
                        {t("game.card.title")}
                    </Text>
                    <Text variant="caption" color="secondary">
                        {drop.prizeDescription}
                    </Text>
                    <Box>
                        <Badge
                            size="small"
                            variant={drop.joined ? "success" : "neutral"}
                        >
                            {drop.joined
                                ? t("game.card.participating")
                                : t("game.card.notParticipating")}
                        </Badge>
                    </Box>
                </Box>
                <Box className={styles.chevron}>
                    <ChevronRightIcon width={16} height={16} />
                </Box>
            </Box>
        </Card>
    );
}
