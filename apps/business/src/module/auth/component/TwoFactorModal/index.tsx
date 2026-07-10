import { Button } from "@frak-labs/design-system/components/Button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@frak-labs/design-system/components/Dialog";
import { FieldError } from "@frak-labs/design-system/components/FieldError";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { Text } from "@frak-labs/design-system/components/Text";
import { ExclamationCircleIcon } from "@frak-labs/design-system/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    useTwoFactorChallenge,
    useTwoFactorVerify,
} from "@/module/auth/hooks/useTwoFactorChallenge";
import { extractAuthErrorMessage } from "@/module/auth/utils/authError";
import { Input } from "@/module/forms/Input";
import {
    type TwoFactorMethod,
    useTwoFactorStore,
} from "@/stores/twoFactorStore";
import * as styles from "./two-factor-modal.css";

// `as const` keeps the values as literal i18n keys so `t()` accepts them
// (a plain `Record<TwoFactorMethod, string>` widens them to `string`).
const METHOD_LABEL_KEY = {
    email: "auth.twoFactor.method.email",
    totp: "auth.twoFactor.method.totp",
    siwe: "auth.twoFactor.method.siwe",
} as const satisfies Record<TwoFactorMethod, string>;

/**
 * Global 2FA challenge/verify modal — driven by `useTwoFactorStore`. Opens
 * for both a stale-session step-up (`stepUpAwareFetch` 401 retry, §4.5) and
 * the `/login/2fa` pending-login completion; the backend semantics of
 * `POST /auth/2fa/verify` are identical in both cases, so this is the single
 * UI for it.
 */
export function TwoFactorModal() {
    const { t } = useTranslation();
    const request = useTwoFactorStore((state) => state.request);
    const resolveVerification = useTwoFactorStore(
        (state) => state.resolveVerification
    );
    const cancelVerification = useTwoFactorStore(
        (state) => state.cancelVerification
    );

    const methods = request?.methods ?? [];
    const [activeMethod, setActiveMethod] = useState<TwoFactorMethod | null>(
        null
    );
    const resolvedMethod = activeMethod ?? methods[0] ?? null;

    if (!request) return null;

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) cancelVerification();
            }}
        >
            <DialogContent className={styles.modal}>
                <Stack space="m">
                    <Stack space="xs">
                        <DialogTitle>{t("auth.twoFactor.title")}</DialogTitle>
                        <DialogDescription>
                            {t("auth.twoFactor.subtitle")}
                        </DialogDescription>
                    </Stack>

                    {methods.length > 1 && (
                        <Tabs
                            value={resolvedMethod ?? undefined}
                            onValueChange={(value) =>
                                setActiveMethod(value as TwoFactorMethod)
                            }
                        >
                            <TabsList>
                                {methods.map((method) => (
                                    <TabsTrigger key={method} value={method}>
                                        {t(METHOD_LABEL_KEY[method])}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    )}

                    {resolvedMethod && (
                        <TwoFactorChallenge
                            method={resolvedMethod}
                            onVerified={resolveVerification}
                        />
                    )}
                </Stack>
            </DialogContent>
        </Dialog>
    );
}

function TwoFactorChallenge({
    method,
    onVerified,
}: {
    method: TwoFactorMethod;
    onVerified: () => void;
}) {
    if (method === "siwe") {
        return <SiweChallenge onVerified={onVerified} />;
    }
    return <CodeChallenge method={method} onVerified={onVerified} />;
}

function CodeChallenge({
    method,
    onVerified,
}: {
    method: "email" | "totp";
    onVerified: () => void;
}) {
    const { t } = useTranslation();
    const [code, setCode] = useState("");
    const {
        mutate: sendChallenge,
        isPending: isSending,
        isSuccess: sent,
        error: sendError,
    } = useTwoFactorChallenge();
    const {
        mutate: verify,
        isPending: isVerifying,
        error: verifyError,
    } = useTwoFactorVerify();

    return (
        <Stack space="s">
            {method === "email" && !sent && (
                <Button
                    variant="secondary"
                    width="auto"
                    loading={isSending}
                    disabled={isSending}
                    onClick={() => sendChallenge("email")}
                >
                    {t("auth.twoFactor.email.sendCode")}
                </Button>
            )}

            {(method === "totp" || sent) && (
                <Stack space="xs">
                    <Text variant="bodySmall" color="secondary">
                        {method === "totp"
                            ? t("auth.twoFactor.totp.hint")
                            : t("auth.twoFactor.email.sentHint")}
                    </Text>
                    <Input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder={t("auth.twoFactor.codePlaceholder")}
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                    />
                    <Button
                        variant="primary"
                        width="auto"
                        loading={isVerifying}
                        disabled={code.length < 6 || isVerifying}
                        onClick={() =>
                            verify(
                                { method, proof: code },
                                { onSuccess: onVerified }
                            )
                        }
                    >
                        {t("auth.twoFactor.verify")}
                    </Button>
                </Stack>
            )}

            {(sendError || verifyError) && (
                <FieldError>
                    {extractAuthErrorMessage(
                        sendError ?? verifyError,
                        t("auth.twoFactor.genericError")
                    )}
                </FieldError>
            )}
        </Stack>
    );
}

function SiweChallenge({ onVerified }: { onVerified: () => void }) {
    const { t } = useTranslation();
    const { mutate: challenge, isPending: isChallenging } =
        useTwoFactorChallenge();
    const {
        mutate: verify,
        isPending: isVerifying,
        error,
    } = useTwoFactorVerify();

    const isPending = isChallenging || isVerifying;

    return (
        <Stack space="s">
            <Text variant="bodySmall" color="secondary">
                {t("auth.twoFactor.siwe.hint")}
            </Text>
            <Button
                variant="primary"
                width="auto"
                loading={isPending}
                disabled={isPending}
                onClick={() =>
                    challenge("siwe", {
                        onSuccess: (data) => {
                            const nonce =
                                data && "nonce" in data
                                    ? data.nonce
                                    : undefined;
                            if (!nonce) return;
                            verify(
                                { method: "siwe", nonce },
                                { onSuccess: onVerified }
                            );
                        },
                    })
                }
            >
                {t("auth.twoFactor.siwe.cta")}
            </Button>
            {error && (
                <Notice
                    tone="error"
                    icon={<ExclamationCircleIcon width={16} height={16} />}
                >
                    {extractAuthErrorMessage(
                        error,
                        t("auth.twoFactor.genericError")
                    )}
                </Notice>
            )}
        </Stack>
    );
}
