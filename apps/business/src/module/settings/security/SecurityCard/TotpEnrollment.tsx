import { Button } from "@frak-labs/design-system/components/Button";
import { FieldError } from "@frak-labs/design-system/components/FieldError";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { encodeQR } from "qr";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/module/forms/Input";
import {
    useTwoFactorActivate,
    useTwoFactorSetup,
} from "@/module/settings/security/useSecuritySettings";

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
        () => encodeQR(otpauthUri, "svg", { ecc: "medium" }),
        [otpauthUri]
    );
    return <div dangerouslySetInnerHTML={{ __html: qrSvg }} />;
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
        return (
            <Stack space="s">
                <Text variant="body" weight="medium">
                    {t("settings.security.totp.recoveryTitle")}
                </Text>
                <Notice tone="warning">
                    {t("settings.security.totp.recoveryHint")}
                </Notice>
                <Stack space="xxs">
                    {activateData.recoveryCodes.map((recoveryCode) => (
                        <Text key={recoveryCode} variant="bodySmall" as="span">
                            {recoveryCode}
                        </Text>
                    ))}
                </Stack>
            </Stack>
        );
    }

    if (step === "enrolling" && setupData?.otpauthUri) {
        return (
            <Stack space="s">
                <Text variant="bodySmall" color="secondary">
                    {t("settings.security.totp.scanHint")}
                </Text>
                <TotpQrCode otpauthUri={setupData.otpauthUri} />
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
                {activateError && (
                    <FieldError>{activateError.message}</FieldError>
                )}
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
