import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { LockIcon } from "@frak-labs/design-system/icons";
import { trackEvent } from "@frak-labs/wallet-shared";
import type { DefaultTranslate } from "@frak-labs/wallet-shared/types";
import { useTranslation } from "react-i18next";
import { GameTaskRow } from "@/module/game/component/GameTaskRow";
import { ICONS, rewardOf } from "@/module/game/utils/gameMissionDisplay";
import {
    type Mission,
    type MissionText,
    missionsListed,
    missionsToDo,
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
                status === "gate" ? (
                    <LockIcon width={16} height={16} />
                ) : (
                    <Icon width={18} height={18} />
                )
            }
            tone={status === "todo" ? "neutral" : "action"}
            title={t(mission.title)}
            hint={textOf(t, mission.hint)}
            badge={{ variant: "info", label: rewardOf(t, id) }}
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

/** The ways to earn tickets the player has left to do, and inviting more friends. */
export function GameMissions({
    missions,
    gameId,
}: {
    missions: Mission[];
    gameId: string;
}) {
    const { t } = useTranslation();
    const toDo = missionsToDo(missions);
    const listed = missionsListed(missions);

    return (
        <Stack space="xs">
            <Text weight="semiBold">{t("game.page.missions.title")}</Text>
            {toDo.length === 0 && (
                <Text variant="bodySmall" color="secondary">
                    {t("game.page.missions.allDone")}
                </Text>
            )}
            {listed.length > 0 && (
                <Card padding="none">
                    {listed.map((mission) => (
                        <MissionRow
                            key={mission.id}
                            mission={mission}
                            gameId={gameId}
                        />
                    ))}
                </Card>
            )}
        </Stack>
    );
}
