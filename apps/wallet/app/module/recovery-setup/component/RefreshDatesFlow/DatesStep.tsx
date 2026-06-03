import { Button } from "@frak-labs/design-system/components/Button";
import { type ReactNode, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import {
    defaultRefreshDateRange,
    ValidityDateFields,
} from "@/module/recovery-setup/component/ValidityDateFields";
import {
    dateToValidAfter,
    dateToValidUntil,
} from "@/module/recovery-setup/utils/recoveryDates";
import * as styles from "../SetupFlow/styles.css";

type DatesStepProps = {
    onSubmit: (params: { validAfter: number; validUntil: number }) => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
};

export function DatesStep({ onSubmit, onBack, stepIndicator }: DatesStepProps) {
    const { t } = useTranslation();
    const formId = useId();
    const initial = useMemo(defaultRefreshDateRange, []);
    const [startDate, setStartDate] = useState(initial.start);
    const [endDate, setEndDate] = useState(initial.end);

    const handleSubmit = () => {
        onSubmit({
            validAfter: dateToValidAfter(
                startDate ? new Date(startDate) : undefined
            ),
            validUntil: dateToValidUntil(
                endDate ? new Date(endDate) : undefined
            ),
        });
    };

    return (
        <FlowStepScreen
            fixedViewport
            title={t("wallet.recoverySetup.dates.dates.title")}
            description={t("wallet.recoverySetup.dates.dates.description")}
            onBack={onBack}
            stepIndicator={stepIndicator}
            footer={
                <Button
                    type="submit"
                    form={formId}
                    variant="primary"
                    size="large"
                    width="full"
                >
                    {t("wallet.recoverySetup.dates.dates.continue")}
                </Button>
            }
        >
            <form
                id={formId}
                className={styles.form}
                onSubmit={(event) => {
                    event.preventDefault();
                    handleSubmit();
                }}
            >
                <ValidityDateFields
                    startDate={startDate}
                    endDate={endDate}
                    onStartChange={setStartDate}
                    onEndChange={setEndDate}
                />
            </form>
        </FlowStepScreen>
    );
}
