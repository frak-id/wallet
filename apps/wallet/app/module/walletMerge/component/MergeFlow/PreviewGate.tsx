import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import type { DefaultTranslate } from "@frak-labs/wallet-shared/types";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";
import type { Step } from "./stepMachine";

/**
 * Total non-terminal steps in the merge flow. Migrate is intentionally
 * counted under the same "4" as Sign so the indicator stays at "X/5"
 * regardless of whether the loser had funds to move — keeps the stepper
 * stable for the user and avoids the "1/?" flicker on Discovery (before
 * the asset summary has had a chance to resolve).
 */
const MERGE_STEP_TOTAL = 5;

const MERGE_STEP_NUMBER: Record<
    Exclude<Step["kind"], "success">,
    1 | 2 | 3 | 4 | 5
> = {
    discovery: 1,
    preview: 2,
    consent: 3,
    sign: 4,
    migrate: 4,
    settling: 5,
};

export function renderStepIndicator(t: DefaultTranslate, kind: Step["kind"]) {
    if (kind === "success") return null;
    return (
        <Text variant="bodySmall" color="secondary">
            {t("wallet.merge.stepIndicator", {
                current: MERGE_STEP_NUMBER[kind],
                total: MERGE_STEP_TOTAL,
            })}
        </Text>
    );
}

export function PreviewGate({
    isError,
    onRetry,
    onAbort,
    stepIndicator,
}: {
    isError: boolean;
    onRetry: () => void;
    onAbort: () => void;
    stepIndicator?: ReactNode;
}) {
    const { t } = useTranslation();
    if (isError) {
        return (
            <EmailFlowResultScreen
                title={t("wallet.merge.preview.errorTitle")}
                description={t("wallet.merge.preview.errorDescription")}
                onBack={onAbort}
                headerCenter={stepIndicator}
            >
                <Button
                    type="button"
                    variant="primary"
                    size="large"
                    width="full"
                    onClick={onRetry}
                >
                    {t("wallet.merge.preview.errorRetry")}
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    size="large"
                    width="full"
                    onClick={onAbort}
                >
                    {t("wallet.merge.preview.cancel")}
                </Button>
            </EmailFlowResultScreen>
        );
    }
    return (
        <EmailFlowResultScreen
            title={t("wallet.merge.preview.loadingTitle")}
            description={
                <Box>{t("wallet.merge.preview.loadingDescription")}</Box>
            }
            onBack={onAbort}
            headerCenter={stepIndicator}
        />
    );
}
