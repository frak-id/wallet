import type {
    GameDrawAdmin,
    GamePlayer,
    PayoutState,
} from "@frak-labs/backend-elysia/orchestration/schemas";
import { Badge } from "@frak-labs/design-system/components/Badge";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import type { GamePhase } from "../format";

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";

const PHASE_VARIANT: Record<GamePhase, BadgeVariant> = {
    upcoming: "info",
    live: "success",
    paused: "warning",
    ended: "neutral",
};

export function GamePhaseBadge({ phase }: { phase: GamePhase }) {
    const { t } = useTranslation();
    return (
        <Badge variant={PHASE_VARIANT[phase]} size="small">
            {t(`internal.game.phase.${phase}`)}
        </Badge>
    );
}

const DRAW_VARIANT: Record<GameDrawAdmin["status"], BadgeVariant> = {
    frozen: "info",
    drawn: "warning",
    confirmed: "success",
    void: "neutral",
};

export function DrawStatusBadge({
    status,
}: {
    status: GameDrawAdmin["status"];
}) {
    const { t } = useTranslation();
    return (
        <Badge variant={DRAW_VARIANT[status]} size="small">
            {t(`internal.draw.status.${status}`)}
        </Badge>
    );
}

const PAYOUT_VARIANT: Record<PayoutState["status"], BadgeVariant> = {
    pending: "info",
    processing: "info",
    bank_depleted: "error",
    settled: "success",
    cancelled: "neutral",
    expired: "error",
};

export function PayoutBadge({ status }: { status: PayoutState["status"] }) {
    const { t } = useTranslation();
    return (
        <Badge variant={PAYOUT_VARIANT[status]} size="small">
            {t(`internal.payout.status.${status}`)}
        </Badge>
    );
}

/** `null` when we cannot tell, e.g. for a handle that was only declared. */
export function FollowBadge({ follows }: { follows: boolean | null }) {
    const { t } = useTranslation();
    if (follows === null) {
        return (
            <Badge size="small" variant="neutral">
                {t("internal.instagram.unknown")}
            </Badge>
        );
    }
    return (
        <Badge size="small" variant={follows ? "success" : "error"}>
            {follows
                ? t("internal.instagram.follows")
                : t("internal.instagram.notFollowing")}
        </Badge>
    );
}

export function InstagramBadges({
    instagram: { level, username, follows },
}: {
    instagram: GamePlayer["instagram"];
}) {
    const { t } = useTranslation();
    if (level === "none") {
        return (
            <Text variant="caption" color="tertiary">
                {t("internal.instagram.none")}
            </Text>
        );
    }
    return (
        <Stack space="none">
            <Text variant="bodySmall">@{username}</Text>
            <Inline space="xxs">
                <Badge
                    size="small"
                    variant={level === "certified" ? "info" : "neutral"}
                >
                    {t(`internal.instagram.${level}`)}
                </Badge>
                {follows !== null && <FollowBadge follows={follows} />}
            </Inline>
        </Stack>
    );
}
