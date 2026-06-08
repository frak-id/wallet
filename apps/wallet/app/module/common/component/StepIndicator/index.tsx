import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";

/**
 * The two `Step N/M` translation keys share the same shape; typing the prop to
 * this union keeps interpolation type-safe while staying flow-agnostic.
 */
type StepIndicatorKey =
    | "wallet.recoverySetup.stepIndicator"
    | "wallet.recoveryUsage.stepIndicator";

type StepIndicatorProps = {
    current: number;
    total: number;
    translationKey: StepIndicatorKey;
};

/** "Step N/M" header label shared by the multi-step recovery flows. */
export function StepIndicator({
    current,
    total,
    translationKey,
}: StepIndicatorProps) {
    const { t } = useTranslation();
    return (
        <Text variant="bodySmall" color="secondary">
            {t(translationKey, { current, total })}
        </Text>
    );
}
