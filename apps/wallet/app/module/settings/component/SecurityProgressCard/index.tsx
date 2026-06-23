import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { ProgressBar } from "@frak-labs/design-system/components/ProgressBar";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useNavigate } from "@tanstack/react-router";
import { CircleCheck, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWalletSecurityStatus } from "@/module/settings/hook/useWalletSecurityStatus";
import * as styles from "./index.css";

/**
 * Profile security hero. Replaces the per-state add-email / verify-email /
 * recovery rows with one card that shows how protected the wallet is and the
 * single next action to take. Once everything is set the card becomes a calm
 * "secured" summary — green check, the protecting email, and no CTA (recovery
 * management lives in its own persistent profile row from then on).
 */
export function SecurityProgressCard() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { email, step } = useWalletSecurityStatus();

    return (
        <Card>
            <Stack space="m">
                <Stack space="s">
                    <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        gap="s"
                    >
                        <Box display="flex" alignItems="center" gap="xs">
                            {step.secured ? (
                                <CircleCheck
                                    size={20}
                                    className={styles.checkIcon}
                                />
                            ) : null}
                            <Text variant="body" weight="medium">
                                {t(
                                    step.secured
                                        ? "wallet.profile.security.headingSecured"
                                        : "wallet.profile.security.heading"
                                )}
                            </Text>
                        </Box>
                        <Text
                            variant="bodySmall"
                            weight="medium"
                            color="tertiary"
                        >
                            {step.percent}%
                        </Text>
                    </Box>
                    <ProgressBar
                        value={step.percent}
                        tone={step.secured ? "success" : "primary"}
                        label={t("wallet.profile.security.progressLabel")}
                    />
                </Stack>

                <Stack space="xs">
                    {!step.secured && (
                        <Text variant="body" weight="semiBold">
                            {t(
                                `wallet.profile.security.steps.${step.key}.title`
                            )}
                        </Text>
                    )}
                    <Text variant="bodySmall" color="secondary">
                        {t(
                            `wallet.profile.security.steps.${step.key}.description`
                        )}
                    </Text>
                    {step.secured && email ? (
                        <Box display="flex" alignItems="center" gap="xs">
                            <Mail size={16} className={styles.emailIcon} />
                            <Text variant="bodySmall" weight="medium">
                                {email}
                            </Text>
                        </Box>
                    ) : null}
                </Stack>

                {!step.secured && (
                    <Button
                        type="button"
                        variant="secondary"
                        size="large"
                        width="full"
                        onClick={() => navigate({ to: step.to })}
                    >
                        {t(`wallet.profile.security.steps.${step.key}.cta`)}
                    </Button>
                )}
            </Stack>
        </Card>
    );
}
