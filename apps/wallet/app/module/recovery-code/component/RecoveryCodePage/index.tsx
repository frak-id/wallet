import { Button } from "@frak-labs/design-system/components/Button";
import { CodeInput, trackEvent } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { useResolveInstallCode } from "@/module/recovery-code/hook/useResolveInstallCode";
import { modalStore } from "@/module/stores/modalStore";

const CODE_LENGTH = 6;

export function RecoveryCodePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [code, setCode] = useState("");
    const openModal = modalStore((s) => s.openModal);

    const {
        resolveAsync,
        isPending,
        error,
        reset: resetMutation,
    } = useResolveInstallCode();

    useEffect(() => {
        trackEvent("install_code_page_viewed");
    }, []);

    const isComplete = code.length === CODE_LENGTH;

    const handleCodeChange = useCallback(
        (value: string) => {
            setCode(value);
            if (error) resetMutation();
        },
        [error, resetMutation]
    );

    const handleValidate = useCallback(async () => {
        if (!isComplete || isPending) return;

        trackEvent("install_code_submitted");
        try {
            const result = await resolveAsync(code);
            openModal({
                id: "recoveryCodeSuccess",
                merchant: result.merchant,
            });
        } catch {
            // Error is captured by the mutation state
        }
    }, [isComplete, isPending, code, resolveAsync, openModal]);

    const errorMessage = error ? t("recoveryCode.error.invalid") : undefined;

    return (
        <FlowStepScreen
            fixedViewport
            title={t("recoveryCode.title")}
            description={t("recoveryCode.description")}
            onBack={() => navigate({ to: "/register", replace: true })}
            footer={
                <Button
                    onClick={handleValidate}
                    disabled={!isComplete}
                    loading={isPending}
                >
                    {t("recoveryCode.validate")}
                </Button>
            }
        >
            <CodeInput
                length={CODE_LENGTH}
                mode="alphanumeric"
                onChange={handleCodeChange}
                label={t("recoveryCode.codeLabel")}
                pasteLabel={t("recoveryCode.paste")}
                error={errorMessage}
            />
        </FlowStepScreen>
    );
}
