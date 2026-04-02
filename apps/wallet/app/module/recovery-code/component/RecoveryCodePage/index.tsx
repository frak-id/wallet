import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { CodeInput } from "@/module/common/component/CodeInput";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { useResolveInstallCode } from "@/module/recovery-code/hook/useResolveInstallCode";
import { modalStore } from "@/module/stores/modalStore";
import * as styles from "./index.css";

const CODE_LENGTH = 6;

export function RecoveryCodePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [code, setCode] = useState("");
    const openModal = modalStore((s) => s.openModal);

    const {
        resolve,
        isLoading,
        error: resolveError,
        setError,
    } = useResolveInstallCode();

    const isComplete = code.length === CODE_LENGTH;

    const handleCodeChange = useCallback(
        (value: string) => {
            setCode(value);
            if (resolveError) setError(undefined);
        },
        [resolveError, setError]
    );

    const handleValidate = useCallback(async () => {
        if (!isComplete || isLoading) return;

        const result = await resolve(code);
        if (result) {
            openModal({ id: "recoveryCodeSuccess" });
        }
    }, [isComplete, isLoading, code, resolve, openModal]);

    const errorMessage = resolveError
        ? t(
              `recoveryCode.error.${resolveError === "UNKNOWN" ? "generic" : "invalid"}`
          )
        : undefined;

    return (
        <PageLayout
            footer={
                <Button
                    onClick={handleValidate}
                    disabled={!isComplete}
                    loading={isLoading}
                >
                    {t("recoveryCode.validate")}
                </Button>
            }
        >
            <Back
                onClick={() => navigate({ to: "/register", replace: true })}
            />
            <div className={styles.wrapper}>
                <Box display={"flex"} flexDirection={"column"} gap={"m"}>
                    <Title size="page">{t("recoveryCode.title")}</Title>
                    <p className={styles.description}>
                        {t("recoveryCode.description")}
                    </p>
                </Box>
                <CodeInput
                    length={CODE_LENGTH}
                    mode="alphanumeric"
                    onChange={handleCodeChange}
                    digitLabel={(i) => `${t("recoveryCode.digitLabel")} ${i}`}
                    pasteLabel={t("recoveryCode.paste")}
                    error={errorMessage}
                />
            </div>
        </PageLayout>
    );
}
