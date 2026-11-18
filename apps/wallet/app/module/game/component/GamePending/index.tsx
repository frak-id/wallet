import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { HeroCard, TicketDeck } from "@/module/game/component/GameHero";
import * as styles from "./index.css";

/** Pending screen of the game routes: the hero's ticket deck shuffles until the page is known. */
export function GamePending() {
    const { t } = useTranslation();

    return (
        <Stack space="m" role="status" aria-label={t("game.loading")}>
            <Back href="/wallet" />
            <Skeleton width="60%" height={38} />
            <HeroCard>
                <TicketDeck face={null} cards={{ shuffling: true }} />
                <span className={styles.heroLine({ width: "long" })} />
                <span className={styles.heroLine({ width: "short" })} />
            </HeroCard>
            <Stack space="xs">
                <Skeleton />
                <Skeleton width="80%" />
            </Stack>
            <Skeleton variant="rect" height={56} />
        </Stack>
    );
}
