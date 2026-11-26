import { FieldError } from "@frak-labs/design-system/components/FieldError";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { NumberBadgeIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { WizardFieldCard } from "@/module/campaigns/component/Creation/WizardFieldCard";
import { currencyMetadata } from "@/module/common/utils/currencyOptions";
import { useAuthStore } from "@/stores/authStore";
import type { MerchantNew } from "@/types/Merchant";
import * as styles from "./merchantWizard.css";

type MerchantRegistrationStepProps = {
    values: MerchantNew;
    error?: Error | null;
    infoTxt?: string;
};

export function MerchantRegistrationStep({
    values,
    error,
    infoTxt,
}: MerchantRegistrationStepProps) {
    const { t } = useTranslation();
    const meta = currencyMetadata[values.currency];
    const hasWallet = useAuthStore((state) => state.wallet !== null);

    const summary = [
        { label: t("merchant.create.summary.name"), value: values.name },
        { label: t("merchant.create.summary.domain"), value: values.domain },
        {
            label: t("merchant.create.summary.currency"),
            value: meta.currencySymbol,
        },
        { label: t("merchant.create.summary.provider"), value: meta.provider },
    ];

    // Only wallet accounts are asked for a confirmation; e-mail accounts are not.
    const instructions = [
        t("merchant.create.instructions.onChain"),
        ...(hasWallet ? [t("merchant.create.instructions.approve")] : []),
        t("merchant.create.instructions.duration"),
    ];

    return (
        <Stack space="l">
            <WizardFieldCard
                label={t("merchant.create.summary.label")}
                description={t("merchant.create.summary.description")}
            >
                <Stack space="none" className={styles.summaryList}>
                    {summary.map((row) => (
                        <Inline
                            key={row.label}
                            space="m"
                            align="space-between"
                            alignY="center"
                            paddingX="m"
                            wrap={false}
                            className={styles.summaryRow}
                        >
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                color="secondary"
                            >
                                {row.label}
                            </Text>
                            <Text variant="bodySmall" weight="medium">
                                {row.value}
                            </Text>
                        </Inline>
                    ))}
                </Stack>
            </WizardFieldCard>

            <WizardFieldCard
                label={t("merchant.create.registration.label")}
                description={t("merchant.create.registration.description")}
            >
                <Stack space="none" className={styles.instructions}>
                    {instructions.map((text, index) => (
                        <Inline
                            key={text}
                            space="m"
                            alignY="center"
                            paddingX="m"
                            paddingY="s"
                            wrap={false}
                        >
                            <NumberBadgeIcon
                                value={(index + 1) as 1 | 2 | 3}
                                width={24}
                                height={24}
                            />
                            <Text
                                variant="body"
                                weight="medium"
                                className={styles.instructionText}
                            >
                                {text}
                            </Text>
                        </Inline>
                    ))}
                </Stack>
            </WizardFieldCard>

            {error && (
                <Stack space="xxs">
                    <FieldError>
                        {t("merchant.create.progress.failed")}
                    </FieldError>
                    {error.message !== t("merchant.create.progress.failed") && (
                        <Text variant="caption" color="secondary">
                            {error.message}
                        </Text>
                    )}
                </Stack>
            )}
            {infoTxt && (
                <Text variant="bodySmall" color="secondary">
                    {infoTxt}
                </Text>
            )}
        </Stack>
    );
}
