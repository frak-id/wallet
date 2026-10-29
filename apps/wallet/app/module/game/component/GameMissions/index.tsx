import { Badge } from "@frak-labs/design-system/components/Badge";
import { Card } from "@frak-labs/design-system/components/Card";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { ProgressBar } from "@frak-labs/design-system/components/ProgressBar";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CartIcon,
    CheckIcon,
    ChevronRightIcon,
    InstagramIcon,
    LockIcon,
    ReferralIcon,
} from "@frak-labs/design-system/icons";
import { trackEvent } from "@frak-labs/wallet-shared";
import type { DefaultTranslate } from "@frak-labs/wallet-shared/types";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
    type Mission,
    type MissionText,
    missionsDone,
} from "@/module/game/utils/gameMissions";
import * as styles from "./index.css";

export const ICONS = {
    join: CheckIcon,
    instagram: InstagramIcon,
    friend: ReferralIcon,
    purchase: CartIcon,
} as const satisfies Record<Mission["id"], unknown>;

export const REWARDS = {
    join: "game.page.missions.reward",
    instagram: "game.page.missions.reward",
    friend: "game.page.missions.rewardPerFriend",
    purchase: "game.page.missions.rewardPerPurchase",
} as const satisfies Record<Mission["id"], string>;

function textOf(
    t: DefaultTranslate,
    { key, values, parts }: MissionText
): string {
    return t(key, {
        ...values,
        parts: parts?.map((part) => textOf(t, part)).join(", "),
    });
}

function MissionRow({ mission }: { mission: Mission }) {
    const { t } = useTranslation();
    const { status } = mission;
    const Icon = ICONS[mission.id];
    const body = (
        <>
            <IconCircle
                size="sm"
                tone={status === "todo" ? "neutral" : "action"}
            >
                {status === "done" ? (
                    <CheckIcon width={16} height={16} />
                ) : status === "gate" ? (
                    <LockIcon width={16} height={16} />
                ) : (
                    <Icon width={18} height={18} />
                )}
            </IconCircle>
            <Stack space="none" className={styles.text}>
                <Text weight="semiBold">{t(mission.title)}</Text>
                <Text
                    variant="bodySmall"
                    color="secondary"
                    className={styles.hint}
                >
                    {textOf(t, mission.hint)}
                </Text>
            </Stack>
            <Badge
                size="small"
                variant={status === "done" ? "success" : "info"}
                className={styles.reward}
            >
                {status === "done"
                    ? t("game.page.missions.earned", { count: mission.earned })
                    : t(REWARDS[mission.id], { count: mission.reward })}
            </Badge>
            {mission.route && <ChevronRightIcon width={16} height={16} />}
        </>
    );
    const className = styles.row({ gate: status === "gate" });
    if (!mission.route) {
        return <div className={className}>{body}</div>;
    }
    const { id } = mission;
    return (
        <Link
            to={mission.route}
            className={className}
            onClick={() =>
                trackEvent("game_mission_clicked", { mission: id, status })
            }
        >
            {body}
        </Link>
    );
}

/** How far the player is through the ways to earn tickets, each a row leading to where to do it. */
export function GameMissions({ missions }: { missions: Mission[] }) {
    const { t } = useTranslation();
    const done = missionsDone(missions);
    const allDone = done === missions.length;

    return (
        <Stack space="xs">
            <Inline space="s" align="space-between" alignY="baseline">
                <Text weight="semiBold">{t("game.page.missions.title")}</Text>
                <Text variant="bodySmall" color="secondary">
                    {t("game.page.missions.progress", {
                        done,
                        total: missions.length,
                    })}
                </Text>
            </Inline>
            <ProgressBar
                value={(done / missions.length) * 100}
                tone={allDone ? "success" : "primary"}
                label={t("game.page.missions.title")}
            />
            <Card padding="none">
                {missions.map((mission) => (
                    <MissionRow key={mission.id} mission={mission} />
                ))}
            </Card>
            {allDone && (
                <Text variant="bodySmall" color="secondary">
                    {t("game.page.missions.allDone")}
                </Text>
            )}
        </Stack>
    );
}
