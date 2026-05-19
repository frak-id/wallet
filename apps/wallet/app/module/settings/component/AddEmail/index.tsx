import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAssociateEmail } from "@/module/authentication/hook/useAssociateEmail";
import { Back } from "@/module/common/component/Back";
import {
    EmailFormScreen,
    emailFormScreenStyles,
} from "@/module/common/component/EmailFormScreen";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import * as styles from "./index.css";

type FlowState =
    | { kind: "input" }
    | { kind: "conflict" }
    | { kind: "success"; email: string };

/**
 * Post-auth "add my email" page. Mounted at `/profile/add-email`, reachable
 * from the wallet home card and the profile row when the current credential
 * has no email attached.
 *
 * The conflict branch is intentionally a dead-end for now — full account
 * merge is the next milestone. Until then we surface the situation but offer
 * no recovery path beyond going back.
 */
export function AddEmail() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [flowState, setFlowState] = useState<FlowState>({ kind: "input" });
    const {
        associateEmail,
        isAssociating,
        error: submitError,
        reset,
    } = useAssociateEmail();

    const goBack = useCallback(() => {
        navigate({ to: "/profile" });
    }, [navigate]);

    const clearTransientState = useCallback(() => {
        if (flowState.kind === "conflict") {
            setFlowState({ kind: "input" });
        }
        if (submitError) reset();
    }, [flowState.kind, submitError, reset]);

    const handleSubmit = useCallback(
        async (email: string) => {
            try {
                const result = await associateEmail(email);
                if (result.status === "conflict") {
                    setFlowState({ kind: "conflict" });
                    return;
                }
                // Both `success` and `alreadyHasEmail` mean the credential
                // now has an email on file; treat them identically.
                setFlowState({ kind: "success", email: result.email });
            } catch {
                // Surface via `submitError` from the hook so the user can
                // retry from the form.
            }
        },
        [associateEmail]
    );

    if (flowState.kind === "success") {
        return (
            <PageLayout fixedViewport back={<Back onClick={goBack} />}>
                <Stack space="l" className={styles.body}>
                    <Stack space="s">
                        <Title size="page">
                            {t("wallet.addEmail.success.title")}
                        </Title>
                        <Text variant="body" color="secondary">
                            {t("wallet.addEmail.success.description", {
                                email: flowState.email,
                            })}
                        </Text>
                    </Stack>
                    <Box className={styles.successActions}>
                        <Button
                            type="button"
                            variant="primary"
                            size="large"
                            width="full"
                            onClick={() => {
                                // Recovery flow rework is still in flight,
                                // so this is intentionally a no-op for now.
                            }}
                        >
                            {t("wallet.addEmail.success.setupRecovery")}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="large"
                            width="full"
                            onClick={goBack}
                        >
                            {t("wallet.addEmail.success.back")}
                        </Button>
                    </Box>
                </Stack>
            </PageLayout>
        );
    }

    const isShowingConflict = flowState.kind === "conflict";

    return (
        <EmailFormScreen
            title={t("wallet.addEmail.title")}
            description={t("wallet.addEmail.description")}
            label={t("wallet.addEmail.label")}
            placeholder={t("wallet.addEmail.placeholder")}
            clearAriaLabel={t("wallet.addEmail.clearAriaLabel")}
            submitLabel={t("wallet.addEmail.continue")}
            onBack={goBack}
            onSubmit={handleSubmit}
            isSubmitting={isAssociating}
            submitDisabled={isShowingConflict}
            onEmailChange={clearTransientState}
        >
            {isShowingConflict && (
                <Box
                    className={emailFormScreenStyles.banner}
                    role="status"
                    aria-live="polite"
                >
                    <Text variant="body">
                        {t("wallet.addEmail.conflict.message")}
                    </Text>
                </Box>
            )}

            {!isShowingConflict && submitError && (
                <Box role="alert" className={emailFormScreenStyles.inlineError}>
                    <Text variant="bodySmall" color="error">
                        {t("wallet.addEmail.submitError")}
                    </Text>
                </Box>
            )}
        </EmailFormScreen>
    );
}
