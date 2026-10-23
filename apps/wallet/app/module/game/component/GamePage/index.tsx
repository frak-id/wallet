import { Badge } from "@frak-labs/design-system/components/Badge";
import { Card } from "@frak-labs/design-system/components/Card";
import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CartIcon,
    LinkIcon,
    ReferralIcon,
} from "@frak-labs/design-system/icons";
import { ExternalLink } from "@frak-labs/wallet-shared";
import { Navigate } from "@tanstack/react-router";
import { Trans, useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { Title } from "@/module/common/component/Title";
import { FRAK_INSTAGRAM_URL, frakGame } from "@/module/game/config";
import { useCurrentGame } from "@/module/game/hook/useCurrentGame";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";

export function GamePage() {
    const { t, i18n } = useTranslation();
    const current = useCurrentGame();
    const game = current.data?.game;
    const me = current.data?.me;

    if (game && !me?.participating) {
        return <Navigate to="/game/join" replace />;
    }

    return (
        <Stack space="m">
            <Back href="/wallet" />
            <Title size="page">{t("game.card.title")}</Title>
            {current.isError ? (
                <EmptyState
                    title={t("game.page.error")}
                    action={{
                        label: t("game.page.retry"),
                        onClick: () => void current.refetch(),
                    }}
                />
            ) : game === null ? (
                <EmptyState
                    title={t("game.page.none.title")}
                    description={t("game.page.none.description")}
                />
            ) : !game || !me ? (
                <Skeleton variant="rect" height={160} />
            ) : (
                <GameDetails
                    prize={
                        game.prizeDescription ??
                        formatGameAmount(game.prizeAmount, i18n.language)
                    }
                    endsAt={game.endsAt}
                    tickets={me.tickets}
                    eligible={me.eligible}
                />
            )}
        </Stack>
    );
}

function GameDetails({
    prize,
    endsAt,
    tickets,
    eligible,
}: {
    prize: string;
    endsAt: Date | string;
    tickets: number;
    eligible: boolean;
}) {
    const { t, i18n } = useTranslation();
    const endDate = new Date(endsAt).toLocaleString(i18n.language, {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <>
            <Card>
                <Stack space="xs" align="center">
                    <Text variant="display1" as="p">
                        {tickets}
                    </Text>
                    <Text color="secondary">
                        {t("game.page.tickets", { count: tickets })}
                    </Text>
                    <Text weight="semiBold" align="center">
                        {prize}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {t("onboarding.game.reward.game.endsAt", {
                            date: endDate,
                        })}
                    </Text>
                </Stack>
            </Card>
            {!eligible && (
                <Stack space="xs">
                    <Notice tone="warning">
                        <Trans
                            i18nKey={
                                frakGame.instagramLink
                                    ? "game.page.lockedLink"
                                    : "game.page.locked"
                            }
                            components={{
                                igLink: (
                                    <ExternalLink href={FRAK_INSTAGRAM_URL} />
                                ),
                            }}
                        />
                    </Notice>
                    {frakGame.instagramLink && (
                        <InfoCard>
                            <InfoRow
                                icon={LinkIcon}
                                label={t("game.page.linkCta")}
                                to="/game/instagram"
                            />
                        </InfoCard>
                    )}
                </Stack>
            )}
            <Stack space="xs">
                <Text weight="semiBold">{t("game.page.more")}</Text>
                <InfoCard>
                    <InfoRow
                        icon={ReferralIcon}
                        label={t("game.page.share")}
                        to="/profile/referral/share"
                    />
                    <InfoRow
                        icon={CartIcon}
                        label={t("game.page.buy")}
                        to="/explorer"
                        action={
                            <Badge size="small" variant="success">
                                {t("game.page.gain", { count: 3 })}
                            </Badge>
                        }
                    />
                </InfoCard>
                <Text variant="bodySmall" color="secondary">
                    {t("game.page.shareHint")}
                </Text>
            </Stack>
        </>
    );
}
