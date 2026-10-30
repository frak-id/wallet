import { Badge } from "@frak-labs/design-system/components/Badge";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { ChevronRightIcon } from "@frak-labs/design-system/icons";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { MissionRoute } from "@/module/game/utils/gameMissions";
import * as styles from "./index.css";

type GameTaskRowProps = {
    icon: ReactNode;
    tone: "neutral" | "action";
    title: string;
    hint: ReactNode;
    badge?: { label: string; variant: "info" | "success" | "warning" };
    gate?: boolean;
    /** For a long hint: the badge moves under it, so the text gets the row's width. */
    stacked?: boolean;
    to?: MissionRoute | "/game/join";
    onClick?: () => void;
};

/** One row of a game checklist; with `to` it leads there, with a chevron. Sits in a `Card padding="none"`. */
export function GameTaskRow({
    icon,
    tone,
    title,
    hint,
    badge,
    gate = false,
    stacked = false,
    to,
    onClick,
}: GameTaskRowProps) {
    const tag = badge && (
        <Badge
            size="small"
            variant={badge.variant}
            className={stacked ? styles.rewardBelow : styles.reward}
        >
            {badge.label}
        </Badge>
    );
    const body = (
        <>
            <IconCircle size="sm" tone={tone}>
                {icon}
            </IconCircle>
            <Stack space="none" className={styles.text}>
                <Text weight="semiBold">{title}</Text>
                <Text
                    variant="bodySmall"
                    color="secondary"
                    className={styles.hint}
                >
                    {hint}
                </Text>
                {stacked && tag}
            </Stack>
            {!stacked && tag}
            {to && <ChevronRightIcon width={16} height={16} />}
        </>
    );
    const className = styles.row({ gate, stacked });
    if (!to) return <div className={className}>{body}</div>;
    return (
        <Link to={to} className={className} onClick={onClick}>
            {body}
        </Link>
    );
}
