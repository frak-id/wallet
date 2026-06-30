import { isValidEmail } from "@frak-labs/app-essentials";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/design-system/components/Accordion";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { ArrowRight, ClipboardPaste } from "lucide-react";
import { type ChangeEvent, type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { WarningCard } from "@/module/common/component/WarningCard";
import { useRequestRecoveryEmail } from "@/module/recovery/hook/useRequestRecoveryEmail";
import { isRecoveryBlobEnvelope } from "@/module/recovery-setup/utils/recoveryBlob";
import * as styles from "./styles.css";

type BlobStepProps = {
    initialEmail?: string;
    onSubmit: (blob: string) => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
};

/**
 * Recovery entry screen. Email-first: the primary path mails a recovery link
 * (anti-enumeration confirmation, mirroring the backend), and a collapsible
 * fallback lets users who still hold their backup paste it and jump straight to
 * the password step.
 */
export function BlobStep({
    initialEmail,
    onSubmit,
    onBack,
    stepIndicator,
}: BlobStepProps) {
    const { t } = useTranslation();
    const emailFormId = useId();
    const blobFormId = useId();
    const [email, setEmail] = useState(initialEmail ?? "");
    const [blob, setBlob] = useState("");
    const [invalid, setInvalid] = useState(false);
    const { requestRecoveryEmail, isRequesting, isSent, error } =
        useRequestRecoveryEmail();

    const canSubmitEmail = isValidEmail(email) && !isRequesting;
    const hasBlob = blob.trim().length > 0;

    const handleEmailSubmit = () => {
        if (!canSubmitEmail) return;
        requestRecoveryEmail(email.trim()).catch(() => {});
    };

    const handleBlobSubmit = () => {
        const trimmed = blob.trim();
        if (!isRecoveryBlobEnvelope(trimmed)) {
            setInvalid(true);
            return;
        }
        onSubmit(trimmed);
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return;
            setBlob(text.trim());
            setInvalid(false);
        } catch {
            // Clipboard read denied/unavailable — manual paste (⌘V) still works.
        }
    };

    return (
        <FlowStepScreen
            title={t("wallet.recoveryUsage.title")}
            description={t("wallet.recoveryUsage.description")}
            onBack={onBack}
            stepIndicator={stepIndicator}
            footer={
                isSent ? undefined : (
                    <Button
                        type="submit"
                        form={emailFormId}
                        variant="primary"
                        size="large"
                        width="full"
                        loading={isRequesting}
                        disabled={!canSubmitEmail}
                    >
                        {t("wallet.recoveryUsage.email.action")}
                    </Button>
                )
            }
        >
            <Stack space="l">
                {isSent ? (
                    <Card variant="muted" padding="default">
                        <Text variant="bodySmall">
                            {t("wallet.recoveryUsage.email.sent")}
                        </Text>
                    </Card>
                ) : (
                    <form
                        id={emailFormId}
                        onSubmit={(event) => {
                            event.preventDefault();
                            handleEmailSubmit();
                        }}
                    >
                        <Input
                            variant="bare"
                            tone="muted"
                            length="big"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            enterKeyHint="send"
                            aria-label={t("wallet.recoveryUsage.email.label")}
                            placeholder={t(
                                "wallet.recoveryUsage.email.placeholder"
                            )}
                            value={email}
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                setEmail(event.target.value)
                            }
                        />
                    </form>
                )}

                {error ? (
                    <WarningCard>
                        {t("wallet.recoveryUsage.email.error")}
                    </WarningCard>
                ) : null}

                <Accordion type="single" collapsible>
                    <AccordionItem value="blob">
                        <AccordionTrigger>
                            {t("wallet.recoveryUsage.blob.toggle")}
                        </AccordionTrigger>
                        <AccordionContent className={styles.blobContent}>
                            <form
                                id={blobFormId}
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    handleBlobSubmit();
                                }}
                            >
                                <Input
                                    type="password"
                                    variant="bare"
                                    tone="muted"
                                    length="big"
                                    autoComplete="off"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    enterKeyHint="go"
                                    aria-label={t(
                                        "wallet.recoveryUsage.blob.label"
                                    )}
                                    placeholder={t(
                                        "wallet.recoveryUsage.blob.placeholder"
                                    )}
                                    error={invalid}
                                    value={blob}
                                    onChange={(event) => {
                                        setBlob(event.target.value);
                                        setInvalid(false);
                                    }}
                                    rightSection={
                                        hasBlob ? (
                                            <Box
                                                as="button"
                                                type="submit"
                                                aria-label={t(
                                                    "wallet.recoveryUsage.blob.continue"
                                                )}
                                            >
                                                <ArrowRight size={16} />
                                            </Box>
                                        ) : (
                                            <Box
                                                as="button"
                                                type="button"
                                                aria-label={t(
                                                    "wallet.recoveryUsage.blob.paste"
                                                )}
                                                onClick={handlePaste}
                                            >
                                                <ClipboardPaste size={16} />
                                            </Box>
                                        )
                                    }
                                />
                            </form>

                            {invalid ? (
                                <WarningCard>
                                    {t("wallet.recoveryUsage.blob.invalid")}
                                </WarningCard>
                            ) : null}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </Stack>
        </FlowStepScreen>
    );
}
