import { Badge } from "@frak-labs/design-system/components/Badge";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CheckIcon,
    CopyIcon,
    InstagramIcon,
} from "@frak-labs/design-system/icons";
import {
    getErrorCode,
    openExternalUrl,
    ua,
    useCopyToClipboardWithState,
} from "@frak-labs/wallet-shared";
import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { Title } from "@/module/common/component/Title";
import { useOnReturn } from "@/module/common/hook/useOnReturn";
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
    useRefreshInstagramFollow,
} from "@/module/instagram/hook/useInstagramLink";

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
    useRefreshInstagramFollow();
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

/** Connecting by DM is the only level that unlocks money, so it leads; the typed handle stays a fallback. */
function Uncertified({
    declaration,
}: {
    declaration: InstagramDeclaration | null;
}) {
    const code = useInstagramLinkCode();
    const unavailable = getErrorCode(code.error) === "INSTAGRAM_UNAVAILABLE";
    return (
        <>
            {declaration && <DeclaredAccount declaration={declaration} />}
            <CertifyCard unavailable={unavailable} />
            {!declaration && <DeclareEntry unavailable={unavailable} />}
        </>
    );
}

function CertifyCard({ unavailable }: { unavailable: boolean }) {
    const { t } = useTranslation();
    return (
        <Card>
            <Stack space="m">
                <Inline space="s" alignY="center" wrap={false}>
                    <IconCircle size="sm">
                        <InstagramIcon width={18} height={18} />
                    </IconCircle>
                    <Stack space="none">
                        <Text weight="semiBold">
                            {t("instagram.certify.title")}
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            {t("instagram.certify.perks")}
                        </Text>
                    </Stack>
                </Inline>
                {unavailable ? (
                    <Notice tone="info">
                        {t("instagram.certify.unavailable")}
                    </Notice>
                ) : (
                    <SendCode />
                )}
            </Stack>
        </Card>
    );
}

/** No "I sent it" button: the DM is looked for as soon as the player is back from Instagram. */
function SendCode() {
    const { t } = useTranslation();
    const code = useInstagramLinkCode();
    const sent = useAwaitInstagramDm();
    const { copy, copied } = useCopyToClipboardWithState();
    const armReturn = useOnReturn(() => {
        if (!sent.isPending) sent.mutate();
    });

    if (code.isError) {
        return (
            <>
                <Notice tone="error">{t("instagram.certify.error")}</Notice>
                <Button
                    variant="ghost"
                    width="full"
                    loading={code.isFetching}
                    onClick={() => void code.refetch()}
                >
                    {t("instagram.retry")}
                </Button>
            </>
        );
    }

    const openInstagram = () => {
        if (!code.data) return;
        copy(code.data);
        armReturn();
        void openExternalUrl(`${FRAK_INSTAGRAM_DM_URL}?ref=${code.data}`);
    };
    const notReceived =
        !sent.isPending &&
        (sent.isError || (sent.isSuccess && sent.data.link === null));

    return (
        <>
            <Card variant="muted" padding="compact">
                <Spread space="s">
                    <Stack space="none">
                        <Text variant="caption" color="secondary">
                            {t("instagram.certify.codeLabel")}
                        </Text>
                        <Text variant="heading3" weight="semiBold">
                            {code.data ?? "…"}
                        </Text>
                    </Stack>
                    <Button
                        variant="ghost"
                        size="small"
                        width="auto"
                        disabled={!code.data}
                        onClick={() => code.data && copy(code.data)}
                    >
                        {copied ? (
                            <CheckIcon width={16} height={16} />
                        ) : (
                            <CopyIcon width={16} height={16} />
                        )}
                        {t(
                            copied
                                ? "instagram.certify.copied"
                                : "instagram.certify.copy"
                        )}
                    </Button>
                </Spread>
            </Card>
            <Text variant="bodySmall" color="secondary">
                {t("instagram.certify.hint")}
            </Text>
            {!ua.isMobile && (
                <Notice tone="info">{t("instagram.mobileOnly")}</Notice>
            )}
            <Button width="full" onClick={openInstagram} disabled={!code.data}>
                {t("instagram.certify.open")}
            </Button>
            {sent.isPending && (
                <Notice tone="info">{t("instagram.certify.waiting")}</Notice>
            )}
            {notReceived && (
                <>
                    <Notice tone={sent.isError ? "error" : "info"}>
                        {sent.isError
                            ? t("instagram.certify.checkError")
                            : t("instagram.certify.notYet", {
                                  code: code.data ?? "…",
                              })}
                    </Notice>
                    <Button
                        variant="ghost"
                        width="full"
                        onClick={() => sent.mutate()}
                    >
                        {t("instagram.certify.checkAgain")}
                    </Button>
                </>
            )}
        </>
    );
}

/** The typed handle: a link until asked for, already open when connecting is unavailable. */
function DeclareEntry({ unavailable }: { unavailable: boolean }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    if (unavailable) return <DeclareCard />;
    if (open) return <DeclareCard onClose={() => setOpen(false)} />;
    return (
        <Button variant="ghost" width="full" onClick={() => setOpen(true)}>
            {t("instagram.declare.open")}
        </Button>
    );
}

/** With `initial`, changes the declared handle; with `onClose`, can be cancelled. */
function DeclareCard({
    initial,
    onClose,
}: {
    initial?: string;
    onClose?: () => void;
}) {
    const { t } = useTranslation();
    const [username, setUsername] = useState(initial ?? "");
    const { declare } = useDeclareInstagram();
    const invalid = getErrorCode(declare.error) === "INVALID_INSTAGRAM_HANDLE";
    const editing = initial !== undefined;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (username.trim()) {
            declare.mutate(username, { onSuccess: onClose });
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
                    {!editing && (
                        <Text variant="bodySmall" color="secondary">
                            {t("instagram.declare.description")}
                        </Text>
                    )}
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
                        {t("instagram.declare.submit")}
                    </Button>
                    {onClose && (
                        <Button
                            type="button"
                            variant="ghost"
                            width="full"
                            onClick={onClose}
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
                initial={declaration.username}
                onClose={() => setEditing(false)}
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
                <NotFollowing />
            )}
        </>
    );
}

/** The follow is re-read when the player is back (`useRefreshInstagramFollow`); the button covers the backend's 30 s cooldown. */
function NotFollowing() {
    const { t } = useTranslation();
    const check = useCheckInstagram();
    return (
        <>
            <Notice tone="warning">{t("instagram.linked.notFollowing")}</Notice>
            <Button
                width="full"
                onClick={() => void openExternalUrl(FRAK_INSTAGRAM_URL)}
            >
                {t("instagram.linked.follow")}
            </Button>
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
    );
}
