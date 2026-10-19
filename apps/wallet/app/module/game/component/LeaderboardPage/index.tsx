import { Badge } from "@frak-labs/design-system/components/Badge";
import { Card } from "@frak-labs/design-system/components/Card";
import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { Title } from "@/module/common/component/Title";
import { useLeaderboard } from "@/module/game/hook/useLeaderboard";
import * as styles from "./index.css";

export function LeaderboardPage() {
    const { t, i18n } = useTranslation();
    const { data, isLoading, error, refetch } = useLeaderboard();
    const meInList = data?.entries.some((entry) => entry.isMe) ?? false;
    const formatScore = (score: number) =>
        t("game.leaderboard.points", {
            score: new Intl.NumberFormat(i18n.language).format(score),
        });

    return (
        <Stack space="m">
            <Back href="/profile" />
            <Title size="page">{t("game.leaderboard.title")}</Title>

            {isLoading ? (
                <Stack space="s">
                    <Skeleton variant="rect" height={64} width="100%" />
                    <Skeleton variant="rect" height={48} width="100%" />
                    <Skeleton variant="rect" height={48} width="100%" />
                    <Skeleton variant="rect" height={48} width="100%" />
                </Stack>
            ) : error || !data ? (
                <EmptyState
                    title={t("game.leaderboard.error.title")}
                    description={t("game.leaderboard.error.description")}
                    action={{
                        label: t("game.leaderboard.error.retry"),
                        onClick: () => refetch(),
                    }}
                />
            ) : (
                <>
                    {!meInList && (
                        <Card variant="muted">
                            {data.me ? (
                                <Spread>
                                    <Text weight="semiBold">
                                        {t("game.leaderboard.myRank", {
                                            rank: data.me.rank,
                                        })}
                                    </Text>
                                    <Text color="secondary">
                                        {formatScore(data.me.score)}
                                    </Text>
                                </Spread>
                            ) : (
                                <Text color="secondary">
                                    {t("game.leaderboard.notRanked")}
                                </Text>
                            )}
                        </Card>
                    )}

                    {data.entries.length === 0 ? (
                        <EmptyState
                            title={t("game.leaderboard.empty.title")}
                            description={t(
                                "game.leaderboard.empty.description"
                            )}
                        />
                    ) : (
                        <Stack
                            as="ol"
                            role="list"
                            space="s"
                            className={styles.list}
                        >
                            {data.entries.map((entry) => (
                                <li key={`${entry.rank}-${entry.displayName}`}>
                                    <Card
                                        padding="cell"
                                        variant={
                                            entry.isMe ? "secondary" : undefined
                                        }
                                    >
                                        <Spread space="m">
                                            <Text
                                                weight="semiBold"
                                                className={styles.name}
                                            >
                                                {entry.rank}.{" "}
                                                <span translate="no">
                                                    {entry.displayName}
                                                </span>
                                                {entry.isMe && (
                                                    <>
                                                        {" "}
                                                        <Badge variant="info">
                                                            {t(
                                                                "game.leaderboard.you"
                                                            )}
                                                        </Badge>
                                                    </>
                                                )}
                                            </Text>
                                            <Text
                                                color="secondary"
                                                className={styles.score}
                                            >
                                                {formatScore(entry.score)}
                                            </Text>
                                        </Spread>
                                    </Card>
                                </li>
                            ))}
                        </Stack>
                    )}
                </>
            )}
        </Stack>
    );
}
