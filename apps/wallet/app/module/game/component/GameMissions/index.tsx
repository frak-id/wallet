import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { ProgressBar } from "@frak-labs/design-system/components/ProgressBar";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon, LockIcon } from "@frak-labs/design-system/icons";
import { trackEvent } from "@frak-labs/wallet-shared";
import type { DefaultTranslate } from "@frak-labs/wallet-shared/types";
import { useTranslation } from "react-i18next";
import { GameTaskRow } from "@/module/game/component/GameTaskRow";
import { ICONS, rewardOf } from "@/module/game/utils/gameMissionDisplay";
import {
    type Mission,
    type MissionText,
    missionsDone,
} from "@/module/game/utils/gameMissions";

function textOf(
    t: DefaultTranslate,
    { key, values, parts }: MissionText
): string {
    return t(key, {
        ...values,
        parts: parts?.map((part) => textOf(t, part)).join(", "),
    });
}

function MissionRow({ mission, gameId }: { mission: Mission; gameId: string }) {
    const { t } = useTranslation();
    const { id, status } = mission;
    const Icon = ICONS[id];

    return (
        <GameTaskRow
            icon={
                status === "done" ? (
                    <CheckIcon width={16} height={16} />
                ) : status === "gate" ? (
                    <LockIcon width={16} height={16} />
                ) : (
                    <Icon width={18} height={18} />
                )
            }
            tone={status === "todo" ? "neutral" : "action"}
            title={t(mission.title)}
            hint={textOf(t, mission.hint)}
            badge={{
                variant: status === "done" ? "success" : "info",
                label:
                    status === "done"
                        ? t("game.page.missions.earned", {
                              count: mission.earned,
                          })
                        : rewardOf(t, id),
            }}
            gate={status === "gate"}
            to={mission.route}
            onClick={() =>
                trackEvent("game_mission_clicked", {
                    mission: id,
                    status,
                    surface: "game_page",
                    game_id: gameId,
                })
            }
        />
    );
}

/** How far the player is through the ways to earn tickets, each a row leading to where to do it. */
export function GameMissions({
    missions,
    gameId,
}: {
    missions: Mission[];
    gameId: string;
}) {
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
                    <MissionRow
                        key={mission.id}
                        mission={mission}
                        gameId={gameId}
                    />
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
