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
import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { InstructionList } from "@/module/common/component/InstructionList";
import { Title } from "@/module/common/component/Title";
import {
    FRAK_INSTAGRAM_DM_URL,
    FRAK_INSTAGRAM_URL,
} from "@/module/instagram/config";
import {
    type InstagramDeclaration,
    type InstagramLink,
    useAwaitInstagramDm,
    useCheckInstagram,
    useDeclareInstagram,
    useInstagramLinkCode,
    useInstagramStatus,
} from "@/module/instagram/hook/useInstagramLink";

const igLink = <ExternalLink href={FRAK_INSTAGRAM_URL} />;

/** Back to whichever page opened this one (profile, game…), or the profile on a deep link. */
function useLeave() {
    const router = useRouter();
    const navigate = useNavigate();
    const canGoBack = useCanGoBack();
    return () =>
        canGoBack ? router.history.back() : navigate({ to: "/profile" });
}

export function InstagramLinkPage() {
    const { t } = useTranslation();
    const status = useInstagramStatus();
    const leave = useLeave();

    return (
        <Stack space="m">
            <Back onClick={leave} />
            <Title size="page">{t("instagram.title")}</Title>
            {status.isError ? (
                <EmptyState
                    title={t("instagram.error")}
                    action={{
                        label: t("instagram.retry"),
                        onClick: () => void status.refetch(),
                    }}
                />
            ) : status.data === undefined ? (
                <Skeleton variant="rect" height={160} />
            ) : status.data.link ? (
                <CertifiedAccount link={status.data.link} onDone={leave} />
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
            <Text color="secondary">{t("instagram.description")}</Text>
            {declaration && <DeclaredAccount declaration={declaration} />}
            <CertifyCard />
            {!declaration && <DeclareCard />}
        </>
    );
}

function CertifyCard() {
    const { t } = useTranslation();
    const code = useInstagramLinkCode();
    const sent = useAwaitInstagramDm();
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
                        {t("instagram.certify.title")}
                    </Text>
                    <Badge size="small" variant="success">
                        {t("instagram.certify.badge")}
                    </Badge>
                </Inline>
                <Stack as="ul" space="xxs">
                    {(["tickets", "unlock", "auto"] as const).map((perk) => (
                        <li key={perk}>
                            <Text variant="bodySmall" color="secondary">
                                <span aria-hidden="true">• </span>
                                {t(`instagram.certify.perks.${perk}`)}
                            </Text>
                        </li>
                    ))}
                </Stack>
                {unavailable ? (
                    <Notice tone="info">
                        {t("instagram.certify.unavailable")}
                    </Notice>
                ) : (
                    <>
                        {!ua.isMobile && (
                            <Notice tone="info">
                                {t("instagram.mobileOnly")}
                            </Notice>
                        )}
                        <InstructionList
                            title={t("instagram.howTo")}
                            steps={[
                                {
                                    title: t("instagram.follow.title"),
                                    description: (
                                        <Trans
                                            i18nKey="instagram.follow.description"
                                            components={{ igLink }}
                                        />
                                    ),
                                },
                                {
                                    title: t("instagram.message.title"),
                                    description: (
                                        <Trans
                                            i18nKey="instagram.message.description"
                                            values={{ code: code.data ?? "…" }}
                                            components={{ code: <strong /> }}
                                        />
                                    ),
                                },
                                {
                                    title: t("instagram.check.title"),
                                    description: t(
                                        "instagram.check.description"
                                    ),
                                },
                            ]}
                        />
                        <Button
                            width="full"
                            onClick={openInstagram}
                            disabled={!code.data}
                        >
                            {t("instagram.open")}
                        </Button>
                        <Button
                            variant="secondary"
                            width="full"
                            onClick={() => sent.mutate()}
                            loading={sent.isPending}
                        >
                            {t("instagram.sent")}
                        </Button>
                        {sent.isPending && (
                            <Notice tone="info">
                                {t("instagram.waiting")}
                            </Notice>
                        )}
                        {code.isError && (
                            <>
                                <Notice tone="error">
                                    {t("instagram.certify.error")}
                                </Notice>
                                <Button
                                    variant="ghost"
                                    width="full"
                                    loading={code.isFetching}
                                    onClick={() => void code.refetch()}
                                >
                                    {t("instagram.retry")}
                                </Button>
                            </>
                        )}
                        {sent.isError && (
                            <Notice tone="error">
                                {t("instagram.certify.checkError")}
                            </Notice>
                        )}
                        {sent.isSuccess && sent.data.link === null && (
                            <Notice tone="info">{t("instagram.notYet")}</Notice>
                        )}
                    </>
                )}
            </Stack>
        </Card>
    );
}

/** With `editing`, changes the declared handle and can be cancelled. */
function DeclareCard({
    editing,
}: {
    editing?: { initial: string; onClose: () => void };
}) {
    const { t } = useTranslation();
    const [username, setUsername] = useState(editing?.initial ?? "");
    const { declare } = useDeclareInstagram();
    const invalid = getErrorCode(declare.error) === "INVALID_INSTAGRAM_HANDLE";

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (username.trim()) {
            declare.mutate(username, { onSuccess: editing?.onClose });
        }
    };

    return (
        <Card>
            <form onSubmit={submit}>
                <Stack space="s">
                    <Text weight="semiBold">
                        {t(
                            editing
                                ? "instagram.declare.editTitle"
                                : "instagram.declare.title"
                        )}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {t("instagram.declare.description")}
                    </Text>
                    <Input
                        label={t("instagram.declare.label")}
                        placeholder={t("instagram.declare.placeholder")}
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
                                    ? "instagram.declare.invalid"
                                    : "instagram.declare.error"
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
                        {t(
                            editing
                                ? "instagram.declare.save"
                                : "instagram.declare.submit"
                        )}
                    </Button>
                    {editing && (
                        <Button
                            type="button"
                            variant="ghost"
                            width="full"
                            onClick={editing.onClose}
                        >
                            {t("instagram.declare.cancel")}
                        </Button>
                    )}
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
                editing={{
                    initial: declaration.username,
                    onClose: () => setEditing(false),
                }}
            />
        );
    }
    return (
        <Card>
            <Stack space="s">
                <Inline space="s" alignY="center">
                    <Text weight="semiBold">@{declaration.username}</Text>
                    <Badge size="small" variant="info">
                        {t("instagram.declare.badge")}
                    </Badge>
                </Inline>
                <Text variant="bodySmall" color="secondary">
                    {t("instagram.declare.counting")}
                </Text>
                <Notice tone="info">{t("instagram.declare.upsell")}</Notice>
                <Inline space="s">
                    <Button
                        width="auto"
                        size="small"
                        variant="secondary"
                        onClick={() => setEditing(true)}
                    >
                        {t("instagram.declare.change")}
                    </Button>
                    <Button
                        width="auto"
                        size="small"
                        variant="ghost"
                        loading={remove.isPending}
                        onClick={() => remove.mutate()}
                    >
                        {t("instagram.declare.remove")}
                    </Button>
                </Inline>
                {remove.isError && (
                    <Notice tone="error">
                        {t("instagram.declare.removeError")}
                    </Notice>
                )}
            </Stack>
        </Card>
    );
}

function CertifiedAccount({
    link,
    onDone,
}: {
    link: InstagramLink;
    onDone: () => void;
}) {
    const { t } = useTranslation();
    const check = useCheckInstagram();

    return (
        <>
            <Card>
                <Inline space="s" alignY="center">
                    <Text weight="semiBold">@{link.username}</Text>
                    <Badge size="small" variant="success">
                        {t("instagram.linked.badge")}
                    </Badge>
                </Inline>
            </Card>
            {link.follows ? (
                <>
                    <Notice tone="success">
                        {t("instagram.linked.counting")}
                    </Notice>
                    <Button width="full" onClick={onDone}>
                        {t("instagram.linked.done")}
                    </Button>
                </>
            ) : (
                <>
                    <Notice tone="warning">
                        <Trans
                            i18nKey="instagram.linked.notFollowing"
                            components={{ igLink }}
                        />
                    </Notice>
                    <Button
                        variant="secondary"
                        width="full"
                        onClick={() => check.mutate()}
                        loading={check.isPending}
                    >
                        {t("instagram.linked.checkAgain")}
                    </Button>
                    {check.isError && (
                        <Notice tone="error">
                            {t("instagram.certify.checkError")}
                        </Notice>
                    )}
                    {check.isSuccess && !check.data.link?.follows && (
                        <Notice tone="info">
                            {t("instagram.linked.stillNotFollowing")}
                        </Notice>
                    )}
                </>
            )}
        </>
    );
}
