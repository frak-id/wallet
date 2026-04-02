import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { CodeInput } from "@/module/common/component/CodeInput";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { modalStore } from "@/module/stores/modalStore";
import * as styles from "./index.css";

const CODE_LENGTH = 6;

export function RecoveryCodePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [code, setCode] = useState("");
    const [error, setError] = useState<string>();
    const openModal = modalStore((s) => s.openModal);

    const isComplete = code.length === CODE_LENGTH;

    const handleCodeChange = useCallback(
        (value: string) => {
            setCode(value);
            // Clear error when user edits the code
            if (error) setError(undefined);
        },
        [error]
    );

    const handleValidate = useCallback(() => {
        if (!isComplete) return;
        // TODO: wire validation logic — set error on failure, success on success
        openModal({ id: "recoveryCodeSuccess" });
    }, [isComplete, openModal]);

    return (
        <PageLayout
            footer={
                <Button onClick={handleValidate} disabled={!isComplete}>
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
                    onChange={handleCodeChange}
                    digitLabel={(i) => `${t("recoveryCode.digitLabel")} ${i}`}
                    pasteLabel={t("recoveryCode.paste")}
                    error={error}
                />
            </div>
        </PageLayout>
    );
}
