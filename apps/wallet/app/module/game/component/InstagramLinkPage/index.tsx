import { Badge } from "@frak-labs/design-system/components/Badge";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    ExternalLink,
    openExternalUrl,
    ua,
    useCopyToClipboardWithState,
} from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { Trans, useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { InstructionList } from "@/module/common/component/InstructionList";
import { Title } from "@/module/common/component/Title";
import {
    FRAK_INSTAGRAM_DM_URL,
    FRAK_INSTAGRAM_URL,
} from "@/module/game/config";
import {
    type InstagramLink,
    useCheckInstagram,
    useInstagramLink,
    useInstagramLinkCode,
} from "@/module/game/hook/useInstagramLink";

const igLink = <ExternalLink href={FRAK_INSTAGRAM_URL} />;

export function InstagramLinkPage() {
    const { t } = useTranslation();
    const link = useInstagramLink();

    return (
        <Stack space="m">
            <Back href="/game" />
            <Title size="page">{t("game.instagram.title")}</Title>
            {link.isError ? (
                <EmptyState
                    title={t("game.page.error")}
                    action={{
                        label: t("game.page.retry"),
                        onClick: () => void link.refetch(),
                    }}
                />
            ) : link.data === undefined ? (
                <Skeleton variant="rect" height={160} />
            ) : link.data ? (
                <LinkedAccount link={link.data} />
            ) : (
                <LinkSteps />
            )}
        </Stack>
    );
}

function LinkSteps() {
    const { t } = useTranslation();
    const code = useInstagramLinkCode().data?.code;
    const check = useCheckInstagram();
    const { copy } = useCopyToClipboardWithState();

    const openInstagram = () => {
        if (!code) return;
        copy(code);
        void openExternalUrl(`${FRAK_INSTAGRAM_DM_URL}?ref=${code}`);
    };

    return (
        <>
            <Text color="secondary">{t("game.instagram.description")}</Text>
            {!ua.isMobile && (
                <Notice tone="info">{t("game.instagram.mobileOnly")}</Notice>
            )}
            <InstructionList
                title={t("game.instagram.howTo")}
                steps={[
                    {
                        title: t("game.instagram.follow.title"),
                        description: (
                            <Trans
                                i18nKey="game.instagram.follow.description"
                                components={{ igLink }}
                            />
                        ),
                    },
                    {
                        title: t("game.instagram.message.title"),
                        description: (
                            <Trans
                                i18nKey="game.instagram.message.description"
                                values={{ code: code ?? "…" }}
                                components={{ code: <strong /> }}
                            />
                        ),
                    },
                    {
                        title: t("game.instagram.check.title"),
                        description: t("game.instagram.check.description"),
                    },
                ]}
            />
            <Stack space="s">
                <Button width="full" onClick={openInstagram} disabled={!code}>
                    {t("game.instagram.open")}
                </Button>
                <Button
                    variant="secondary"
                    width="full"
                    onClick={() => check.mutate()}
                    loading={check.isPending}
                >
                    {t("game.instagram.sent")}
                </Button>
            </Stack>
            {check.isSuccess && check.data === null && (
                <Notice tone="info">{t("game.instagram.notYet")}</Notice>
            )}
        </>
    );
}

function LinkedAccount({ link }: { link: InstagramLink }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const check = useCheckInstagram();

    return (
        <>
            <Card>
                <Inline space="s" alignY="center">
                    <Text weight="semiBold">@{link.username}</Text>
                    <Badge size="small" variant="success">
                        {t("game.instagram.linked.badge")}
                    </Badge>
                </Inline>
            </Card>
            {link.follows ? (
                <>
                    <Notice tone="success">
                        {t("game.instagram.linked.counting")}
                    </Notice>
                    <Button
                        width="full"
                        onClick={() => navigate({ to: "/game" })}
                    >
                        {t("game.instagram.linked.back")}
                    </Button>
                </>
            ) : (
                <>
                    <Notice tone="warning">
                        <Trans
                            i18nKey="game.instagram.linked.notFollowing"
                            components={{ igLink }}
                        />
                    </Notice>
                    <Button
                        variant="secondary"
                        width="full"
                        onClick={() => check.mutate()}
                        loading={check.isPending}
                    >
                        {t("game.instagram.linked.checkAgain")}
                    </Button>
                    {check.isSuccess && !check.data?.follows && (
                        <Notice tone="info">
                            {t("game.instagram.linked.stillNotFollowing")}
                        </Notice>
                    )}
                </>
            )}
        </>
    );
}
