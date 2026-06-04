import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { TextArea } from "@frak-labs/design-system/components/TextArea";
import { type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { WarningCard } from "@/module/common/component/WarningCard";
import { isRecoveryBlobEnvelope } from "@/module/recovery-setup/utils/recoveryBlob";
import * as styles from "./styles.css";
import { TryExistingPasskey } from "./TryExistingPasskey";

type BlobStepProps = {
    onSubmit: (blob: string) => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
};

export function BlobStep({ onSubmit, onBack, stepIndicator }: BlobStepProps) {
    const { t } = useTranslation();
    const formId = useId();
    const [blob, setBlob] = useState("");
    const [invalid, setInvalid] = useState(false);

    const handleSubmit = () => {
        const trimmed = blob.trim();
        if (!isRecoveryBlobEnvelope(trimmed)) {
            setInvalid(true);
            return;
        }
        onSubmit(trimmed);
    };

    return (
        <FlowStepScreen
            title={t("wallet.recoveryUsage.blob.title")}
            description={t("wallet.recoveryUsage.blob.description")}
            onBack={onBack}
            stepIndicator={stepIndicator}
            footer={
                <Stack space="s">
                    <Button
                        type="submit"
                        form={formId}
                        variant="primary"
                        size="large"
                        width="full"
                        disabled={blob.trim().length === 0}
                    >
                        {t("wallet.recoveryUsage.blob.continue")}
                    </Button>
                    <TryExistingPasskey />
                </Stack>
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
                <TextArea
                    length="big"
                    className={styles.blobInput}
                    aria-label={t("wallet.recoveryUsage.blob.label")}
                    placeholder={t("wallet.recoveryUsage.blob.placeholder")}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    error={invalid}
                    value={blob}
                    onChange={(event) => {
                        setBlob(event.target.value);
                        setInvalid(false);
                    }}
                />
            </form>

            {invalid ? (
                <WarningCard>
                    {t("wallet.recoveryUsage.blob.invalid")}
                </WarningCard>
            ) : null}
        </FlowStepScreen>
    );
}
