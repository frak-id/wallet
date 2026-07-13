import { Badge } from "@frak-labs/design-system/components/Badge";
import { Button } from "@frak-labs/design-system/components/Button";
import { FieldError } from "@frak-labs/design-system/components/FieldError";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CheckIcon,
    CopyIcon,
    DownloadIcon,
} from "@frak-labs/design-system/icons";
import { encodeQR } from "qr";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEnrolledTwoFactorMethods } from "@/module/auth/hooks/useTwoFactorChallenge";
import { CopyableValue } from "@/module/common/component/CopyableValue";
import { useCopyToClipboardWithState } from "@/module/common/hook/useCopyToClipboardWithState";
import { Input } from "@/module/forms/Input";
import {
    useTwoFactorActivate,
    useTwoFactorSetup,
} from "@/module/settings/security/useSecuritySettings";
import * as styles from "./totp-enrollment.css";

/**
 * Renders the TOTP `otpauthUri` as an SVG QR code client-side (§2.2): the
 * backend only returns the otpauth URI now, not a pre-rendered SVG — this
 * replaces the previous `dangerouslySetInnerHTML` block of a
 * server-generated SVG string with a client-generated one built the same
 * way (`qr`'s built-in SVG output), so it's still just markup, not user
 * input reaching the DOM.
 */
function TotpQrCode({ otpauthUri }: { otpauthUri: string }) {
    const qrSvg = useMemo(
        () =>
            // The `qr` SVG carries only a viewBox (no width/height) — inject a
            // fill-the-frame style on the root element so it scales to the
            // container (vanilla-extract can't size a descendant `& svg`).
            encodeQR(otpauthUri, "svg", { ecc: "medium" }).replace(
                "<svg ",
                '<svg style="display:block;width:100%;height:100%" '
            ),
        [otpauthUri]
    );
    return (
        <div
            className={styles.qrFrame}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
    );
}

/**
 * The base32 `secret` param carried by the otpauth URI, grouped in 4-char
 * blocks for legibility — the manual-entry fallback for authenticators that
 * can't scan the QR. Parsed client-side so the raw secret still never leaves
 * the setup response (§2.2).
 */
function manualEntrySecret(otpauthUri: string): string | null {
    const secret = new URL(otpauthUri).searchParams.get("secret");
    return secret?.match(/.{1,4}/g)?.join(" ") ?? secret;
}

function TotpManualKey({ otpauthUri }: { otpauthUri: string }) {
    const { t } = useTranslation();
    const formatted = useMemo(
        () => manualEntrySecret(otpauthUri),
        [otpauthUri]
    );
    if (!formatted) return null;

    return (
        <Stack space="xxs">
            <Text variant="bodySmall" color="secondary">
                {t("settings.security.totp.manualHint")}
            </Text>
            <CopyableValue
                value={formatted}
                copyText={formatted.replace(/\s/g, "")}
            />
        </Stack>
    );
}

/**
 * TOTP enrollment (§5 deliverable 5): setup → QR + otpauth URI → 6-digit
 * confirm → one-time recovery codes display. `setup`/`activate` are
 * step-up-guarded server-side for accounts that already have a 2FA method
 * (bootstrap accounts with zero methods skip that check, §twoFactor.ts).
 */
export function TotpEnrollment() {
    const { t } = useTranslation();
    const [step, setStep] = useState<"idle" | "enrolling" | "done">("idle");
    const { data: methods } = useEnrolledTwoFactorMethods(true);
    const {
        mutate: setup,
        data: setupData,
        isPending: isSettingUp,
        error: setupError,
    } = useTwoFactorSetup();
    const {
        mutate: activate,
        data: activateData,
        isPending: isActivating,
        error: activateError,
    } = useTwoFactorActivate();
    const [code, setCode] = useState("");

    if (step === "done" && activateData?.recoveryCodes) {
        return <RecoveryCodes codes={activateData.recoveryCodes} />;
    }

    // Already enrolled: the /setup call would fail with TOTP_ALREADY_ACTIVATED,
    // so surface the enabled state instead of a dead "Enable" button. Skipped
    // while mid-enrollment so the just-activated flow still shows the code
    // steps from local state.
    if (step === "idle" && methods?.includes("totp")) {
        return (
            <Stack space="xs">
                <Text variant="body" weight="medium">
                    {t("settings.security.totp.title")}
                </Text>
                {/* Wrap in `Inline` so the pill hugs its content — a bare
                    `Badge` in the `Stack` would stretch to full width. */}
                <Inline space="xs" alignY="center">
                    <Badge variant="success">
                        {t("settings.security.totp.enabled")}
                    </Badge>
                </Inline>
            </Stack>
        );
    }

    if (step === "enrolling" && setupData?.otpauthUri) {
        return (
            <Stack space="s">
                <Text variant="bodySmall" color="secondary">
                    {t("settings.security.totp.scanHint")}
                </Text>
                {/* Side-by-side on wide viewports; `Inline`'s default
                    `wrap` collapses the manual key under the QR once the
                    fixed QR width + the key's min-width no longer fit on
                    one line (there's no `collapseBelow` on Columns/Column). */}
                <Inline space="m" alignY="top">
                    <div className={styles.qrColumn}>
                        <TotpQrCode otpauthUri={setupData.otpauthUri} />
                    </div>
                    <div className={styles.manualColumn}>
                        <TotpManualKey otpauthUri={setupData.otpauthUri} />
                    </div>
                </Inline>
                <Input
                    variant="bare"
                    tone="muted"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    label={t("auth.twoFactor.codePlaceholder")}
                    error={Boolean(activateError)}
                    hint={activateError ? activateError.message : undefined}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                />
                <Button
                    variant="primary"
                    width="auto"
                    loading={isActivating}
                    disabled={code.length < 6 || isActivating}
                    onClick={() =>
                        activate(
                            { method: "totp", proof: code },
                            { onSuccess: () => setStep("done") }
                        )
                    }
                >
                    {t("settings.security.totp.confirm")}
                </Button>
            </Stack>
        );
    }

    return (
        <Stack space="xs">
            <Text variant="body" weight="medium">
                {t("settings.security.totp.title")}
            </Text>
            <Button
                variant="secondary"
                width="auto"
                loading={isSettingUp}
                disabled={isSettingUp}
                onClick={() =>
                    setup("totp", {
                        onSuccess: () => setStep("enrolling"),
                    })
                }
            >
                {t("settings.security.totp.enable")}
            </Button>
            {setupError && <FieldError>{setupError.message}</FieldError>}
        </Stack>
    );
}

function RecoveryCodes({ codes }: { codes: string[] }) {
    const { t } = useTranslation();
    const { copied, copy } = useCopyToClipboardWithState();

    const asText = codes.join("\n");

    const download = () => {
        const blob = new Blob([asText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "frak-recovery-codes.txt";
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Stack space="s">
            <Text variant="body" weight="medium">
                {t("settings.security.totp.recoveryTitle")}
            </Text>
            <Notice tone="warning">
                {t("settings.security.totp.recoveryHint")}
            </Notice>
            <div className={styles.codesBox}>
                {codes.map((recoveryCode) => (
                    <span key={recoveryCode} className={styles.code}>
                        {recoveryCode}
                    </span>
                ))}
            </div>
            <Inline space="s">
                <Button
                    variant="secondary"
                    size="small"
                    width="auto"
                    onClick={() => copy(asText)}
                    icon={
                        copied ? (
                            <CheckIcon width={16} height={16} />
                        ) : (
                            <CopyIcon width={16} height={16} />
                        )
                    }
                >
                    {copied
                        ? t("common.copied")
                        : t("settings.security.totp.copyCodes")}
                </Button>
                <Button
                    variant="secondary"
                    size="small"
                    width="auto"
                    onClick={download}
                    icon={<DownloadIcon width={16} height={16} />}
                >
                    {t("settings.security.totp.downloadCodes")}
                </Button>
            </Inline>
        </Stack>
    );
}
