import { Button } from "@frak-labs/design-system/components/Button";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    useEnrolledTwoFactorMethods,
    useTwoFactorChallenge,
    useTwoFactorVerify,
} from "@/module/auth/hooks/useTwoFactorChallenge";
import { extractAuthErrorMessage } from "@/module/auth/utils/authError";
import { Input } from "@/module/forms/Input";
import type { TwoFactorMethod } from "@/stores/twoFactorStore";
import { OrDivider } from "../LoginMethods/OrDivider";

// `as const` keeps the values as literal i18n keys so `t()` accepts them
// (a plain `Record<TwoFactorMethod, string>` widens them to `string`).
const METHOD_LABEL_KEY = {
    email: "auth.twoFactor.method.email",
    totp: "auth.twoFactor.method.totp",
    siwe: "auth.twoFactor.method.siwe",
} as const satisfies Record<TwoFactorMethod, string>;

// Primary-method preference: authenticator app first (most users' default),
// then email, then wallet. The first available method is auto-selected so the
// common path renders its challenge with no extra click (§4.5).
const METHOD_PRIORITY: TwoFactorMethod[] = ["totp", "email", "siwe"];

function orderMethods(methods: TwoFactorMethod[]): TwoFactorMethod[] {
    return [...methods].sort(
        (a, b) => METHOD_PRIORITY.indexOf(a) - METHOD_PRIORITY.indexOf(b)
    );
}

/**
 * Heading render slots. Injected so the modal can bind the title/description to
 * Radix (`DialogTitle`/`DialogDescription` → accessible `aria-labelledby`/
 * `-describedby`), which this component can't render itself since it has no
 * `Dialog` ancestor in the inline case. Defaults to plain visible headings.
 */
export type TwoFactorHeadingSlot = (props: {
    children: ReactNode;
}) => ReactNode;

const DefaultTitle: TwoFactorHeadingSlot = ({ children }) => (
    <Text as="h2" variant="heading4">
        {children}
    </Text>
);

const DefaultDescription: TwoFactorHeadingSlot = ({ children }) => (
    <Text as="p" variant="bodySmall" color="secondary">
        {children}
    </Text>
);

/**
 * Presentational 2FA challenge/verify UI — no `Dialog` wrapper, so it can sit
 * either inside `TwoFactorModal` (step-up re-auth, §4.5) or inline on
 * `/login/2fa` within the branded login shell (no modal over a blank page).
 * The heading elements are injected via `Title`/`Description` so the modal can
 * bind them to Radix for an accessible dialog name while the inline case uses
 * plain visible headings.
 *
 * Interaction: the highest-priority available method is auto-selected and its
 * challenge shown immediately; "Try another way" reveals the alternatives.
 */
export function TwoFactorChallengePanel({
    methods,
    onVerified,
    Title = DefaultTitle,
    Description = DefaultDescription,
}: {
    methods: TwoFactorMethod[];
    onVerified: () => void;
    Title?: TwoFactorHeadingSlot;
    Description?: TwoFactorHeadingSlot;
}) {
    const { t } = useTranslation();

    // The account's real enrolled channels are authoritative (the advertised
    // list handed in via the store is only a hint, and the Shopify SSO path
    // has none). This component only ever mounts once there's an active
    // challenge, so the query is unconditionally enabled.
    const { data: enrolledMethods } = useEnrolledTwoFactorMethods(true);
    const orderedMethods = useMemo(
        () => orderMethods(enrolledMethods ?? methods),
        [enrolledMethods, methods]
    );
    const [activeMethod, setActiveMethod] = useState<TwoFactorMethod | null>(
        null
    );

    const resolvedMethod = activeMethod ?? orderedMethods[0] ?? null;
    const alternatives = orderedMethods.filter(
        (method) => method !== resolvedMethod
    );

    return (
        <Stack space="m">
            <Stack space="xs">
                <Title>{t("auth.twoFactor.title")}</Title>
                <Description>{t("auth.twoFactor.subtitle")}</Description>
            </Stack>

            {resolvedMethod && (
                <TwoFactorChallenge
                    // Remount on method change so per-method input
                    // state (code, sent flag) resets cleanly.
                    key={resolvedMethod}
                    method={resolvedMethod}
                    onVerified={onVerified}
                />
            )}

            {alternatives.length > 0 && (
                <Stack space="xs">
                    <OrDivider label={t("auth.login.or")} />
                    {alternatives.map((method) => (
                        <Button
                            key={method}
                            variant="secondary"
                            width="full"
                            onClick={() => setActiveMethod(method)}
                        >
                            {t(METHOD_LABEL_KEY[method])}
                        </Button>
                    ))}
                </Stack>
            )}
        </Stack>
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

// Which hint copy to show for the code-entry step, kept out of the JSX so the
// component stays under the cognitive-complexity budget.
function codeHintKey(method: "email" | "totp", recoveryMode: boolean) {
    if (recoveryMode) return "auth.twoFactor.totp.recoveryHint";
    return method === "totp"
        ? "auth.twoFactor.totp.hint"
        : "auth.twoFactor.email.sentHint";
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
    // Recovery codes are a TOTP-only fallback (§1.7): the backend `totp`
    // verify path already consumes them, so they submit as `method: "totp"`
    // — only the input shape differs (10 hex chars, not a 6-digit numeric).
    const [recoveryMode, setRecoveryMode] = useState(false);
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

    const error = sendError ?? verifyError;
    const trimmed = code.trim();
    const canSubmit = recoveryMode ? trimmed.length >= 10 : trimmed.length >= 6;

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
                    {recoveryMode && (
                        <Notice tone="info">
                            {t("auth.twoFactor.totp.recoveryNotice")}
                        </Notice>
                    )}
                    <Text variant="bodySmall" color="secondary">
                        {t(codeHintKey(method, recoveryMode))}
                    </Text>
                    <Input
                        // Remount on mode switch so numeric vs text input
                        // attributes reset cleanly.
                        key={recoveryMode ? "recovery" : "code"}
                        variant="bare"
                        tone="muted"
                        autoFocus
                        inputMode={recoveryMode ? "text" : "numeric"}
                        autoComplete={recoveryMode ? "off" : "one-time-code"}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={recoveryMode ? 20 : 6}
                        label={t(
                            recoveryMode
                                ? "auth.twoFactor.totp.recoveryPlaceholder"
                                : "auth.twoFactor.codePlaceholder"
                        )}
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                    />
                    <Button
                        variant="primary"
                        width="auto"
                        loading={isVerifying}
                        disabled={!canSubmit || isVerifying}
                        onClick={() =>
                            verify(
                                { method, proof: trimmed },
                                { onSuccess: onVerified }
                            )
                        }
                    >
                        {t("auth.twoFactor.verify")}
                    </Button>
                    {method === "totp" && (
                        <Button
                            variant="ghost"
                            size="small"
                            width="auto"
                            onClick={() => {
                                setRecoveryMode((prev) => !prev);
                                setCode("");
                            }}
                        >
                            {t(
                                recoveryMode
                                    ? "auth.twoFactor.totp.useCode"
                                    : "auth.twoFactor.totp.useRecovery"
                            )}
                        </Button>
                    )}
                    {method === "email" && sent && (
                        <Button
                            variant="ghost"
                            size="small"
                            width="auto"
                            loading={isSending}
                            disabled={isSending}
                            onClick={() => sendChallenge("email")}
                        >
                            {t("auth.twoFactor.email.resend")}
                        </Button>
                    )}
                </Stack>
            )}

            {error && (
                <Notice tone="error">
                    {extractAuthErrorMessage(
                        error,
                        t("auth.twoFactor.genericError")
                    )}
                </Notice>
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
                <Notice tone="error">
                    {extractAuthErrorMessage(
                        error,
                        t("auth.twoFactor.genericError")
                    )}
                </Notice>
            )}
        </Stack>
    );
}
