import { Badge } from "@frak-labs/design-system/components/Badge";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    ExternalLink,
    getErrorCode,
    openExternalUrl,
    ua,
    useCopyToClipboardWithState,
} from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { InstructionList } from "@/module/common/component/InstructionList";
import { Title } from "@/module/common/component/Title";
import {
    FRAK_INSTAGRAM_DM_URL,
    FRAK_INSTAGRAM_URL,
} from "@/module/game/config";
import {
    type InstagramDeclaration,
    type InstagramLink,
    useCheckInstagram,
    useDeclareInstagram,
    useInstagramLinkCode,
    useInstagramStatus,
} from "@/module/game/hook/useInstagramLink";

const igLink = <ExternalLink href={FRAK_INSTAGRAM_URL} />;

export function InstagramLinkPage() {
    const { t } = useTranslation();
    const status = useInstagramStatus();

    return (
        <Stack space="m">
            <Back href="/game" />
            <Title size="page">{t("game.instagram.title")}</Title>
            {status.isError ? (
                <EmptyState
                    title={t("game.page.error")}
                    action={{
                        label: t("game.page.retry"),
                        onClick: () => void status.refetch(),
                    }}
                />
            ) : status.data === undefined ? (
                <Skeleton variant="rect" height={160} />
            ) : status.data.link ? (
                <CertifiedAccount link={status.data.link} />
            ) : (
                <Uncertified declaration={status.data.declaration} />
            )}
        </Stack>
    );
}

/** Certifying is offered first, since it is the only level that unlocks money. */
function Uncertified({
    declaration,
}: {
    declaration: InstagramDeclaration | null;
}) {
    const { t } = useTranslation();
    return (
        <>
            <Text color="secondary">{t("game.instagram.description")}</Text>
            {declaration && <DeclaredAccount declaration={declaration} />}
            <CertifyCard />
            {!declaration && <DeclareCard />}
        </>
    );
}

function CertifyCard() {
    const { t } = useTranslation();
    const code = useInstagramLinkCode({ enabled: true });
    const check = useCheckInstagram();
    const { copy } = useCopyToClipboardWithState();
    const unavailable = getErrorCode(code.error) === "INSTAGRAM_UNAVAILABLE";

    const openInstagram = () => {
        if (!code.data) return;
        copy(code.data);
        void openExternalUrl(`${FRAK_INSTAGRAM_DM_URL}?ref=${code.data}`);
    };

    return (
        <Card>
            <Stack space="s">
                <Inline space="s" alignY="center">
                    <Text weight="semiBold">
                        {t("game.instagram.certify.title")}
                    </Text>
                    <Badge size="small" variant="success">
                        {t("game.instagram.certify.badge")}
                    </Badge>
                </Inline>
                <Stack space="xxs">
                    {(["tickets", "unlock", "auto"] as const).map((perk) => (
                        <Text key={perk} variant="bodySmall" color="secondary">
                            {`• ${t(`game.instagram.certify.perks.${perk}`)}`}
                        </Text>
                    ))}
                </Stack>
                {unavailable ? (
                    <Notice tone="info">
                        {t("game.instagram.certify.unavailable")}
                    </Notice>
                ) : (
                    <>
                        {!ua.isMobile && (
                            <Notice tone="info">
                                {t("game.instagram.mobileOnly")}
                            </Notice>
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
                                            values={{ code: code.data ?? "…" }}
                                            components={{ code: <strong /> }}
                                        />
                                    ),
                                },
                                {
                                    title: t("game.instagram.check.title"),
                                    description: t(
                                        "game.instagram.check.description"
                                    ),
                                },
                            ]}
                        />
                        <Button
                            width="full"
                            onClick={openInstagram}
                            disabled={!code.data}
                        >
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
                        {code.isError && (
                            <Notice tone="error">
                                {t("game.instagram.certify.error")}
                            </Notice>
                        )}
                        {check.isError && (
                            <Notice tone="error">
                                {t("game.instagram.certify.checkError")}
                            </Notice>
                        )}
                        {check.isSuccess && check.data.link === null && (
                            <Notice tone="info">
                                {t("game.instagram.notYet")}
                            </Notice>
                        )}
                    </>
                )}
            </Stack>
        </Card>
    );
}

function DeclareCard({
    initial = "",
    onDone,
}: {
    initial?: string;
    onDone?: () => void;
}) {
    const { t } = useTranslation();
    const [username, setUsername] = useState(initial);
    const { declare } = useDeclareInstagram();
    const invalid = getErrorCode(declare.error) === "INVALID_INSTAGRAM_HANDLE";

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (username.trim()) {
            declare.mutate(username, { onSuccess: onDone });
        }
    };

    return (
        <Card>
            <form onSubmit={submit}>
                <Stack space="s">
                    <Text weight="semiBold">
                        {t("game.instagram.declare.title")}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {t("game.instagram.declare.description")}
                    </Text>
                    <Input
                        label={t("game.instagram.declare.label")}
                        placeholder={t("game.instagram.declare.placeholder")}
                        value={username}
                        autoCapitalize="none"
                        autoCorrect="off"
                        error={invalid}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    {declare.isError && (
                        <Notice tone="error">
                            {t(
                                invalid
                                    ? "game.instagram.declare.invalid"
                                    : "game.instagram.declare.error"
                            )}
                        </Notice>
                    )}
                    <Button
                        type="submit"
                        variant="secondary"
                        width="full"
                        disabled={!username.trim()}
                        loading={declare.isPending}
                    >
                        {t("game.instagram.declare.submit")}
                    </Button>
                </Stack>
            </form>
        </Card>
    );
}

function DeclaredAccount({
    declaration,
}: {
    declaration: InstagramDeclaration;
}) {
    const { t } = useTranslation();
    const { remove } = useDeclareInstagram();
    const [editing, setEditing] = useState(false);

    if (editing) {
        return (
            <DeclareCard
                initial={declaration.username}
                onDone={() => setEditing(false)}
            />
        );
    }
    return (
        <Card>
            <Stack space="s">
                <Inline space="s" alignY="center">
                    <Text weight="semiBold">@{declaration.username}</Text>
                    <Badge size="small" variant="info">
                        {t("game.instagram.declare.badge")}
                    </Badge>
                </Inline>
                <Text variant="bodySmall" color="secondary">
                    {t("game.page.declared")}
                </Text>
                <Notice tone="info">
                    {t("game.instagram.declare.upsell")}
                </Notice>
                <Inline space="s">
                    <Button
                        width="auto"
                        size="small"
                        variant="secondary"
                        onClick={() => setEditing(true)}
                    >
                        {t("game.instagram.declare.change")}
                    </Button>
                    <Button
                        width="auto"
                        size="small"
                        variant="ghost"
                        loading={remove.isPending}
                        onClick={() => remove.mutate()}
                    >
                        {t("game.instagram.declare.remove")}
                    </Button>
                </Inline>
            </Stack>
        </Card>
    );
}

function CertifiedAccount({ link }: { link: InstagramLink }) {
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
                    {check.isError && (
                        <Notice tone="error">
                            {t("game.instagram.certify.checkError")}
                        </Notice>
                    )}
                    {check.isSuccess && !check.data.link?.follows && (
                        <Notice tone="info">
                            {t("game.instagram.linked.stillNotFollowing")}
                        </Notice>
                    )}
                </>
            )}
        </>
    );
}
