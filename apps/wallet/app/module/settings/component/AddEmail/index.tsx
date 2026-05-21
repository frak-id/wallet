import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { selectSession, sessionStore } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { useStore } from "zustand";
import { useAssociateEmail } from "@/module/authentication/hook/useAssociateEmail";
import {
    EmailFormScreen,
    emailFormScreenStyles,
} from "@/module/common/component/EmailFormScreen";
import { MergeFlow } from "@/module/walletMerge/component/MergeFlow";
import { ConflictStep } from "./ConflictStep";
import { SuccessStep } from "./SuccessStep";

type FlowState =
    | { kind: "input" }
    | {
          kind: "conflict";
          email: string;
          targetAuthenticatorId?: string;
          targetWallet?: Address;
      }
    | {
          kind: "merging";
          email: string;
          targetAuthenticatorId: string;
          targetWallet: Address;
      }
    | { kind: "success"; email: string };

/**
 * Post-auth "add my email" page. Mounted at `/profile/add-email`, reachable
 * from the wallet home card and the profile row when the current credential
 * has no email attached.
 *
 * Each terminal state (success, conflict, merging) renders as a dedicated
 * screen so the input step stays clean and the user can navigate back
 * without a patchwork of conditional banners.
 */
export function AddEmail() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const session = useStore(sessionStore, selectSession);
    const [flowState, setFlowState] = useState<FlowState>({ kind: "input" });
    const {
        associateEmail,
        isAssociating,
        error: submitError,
        reset,
    } = useAssociateEmail();

    const goToProfile = useCallback(() => {
        navigate({ to: "/profile" });
    }, [navigate]);

    const backToInput = useCallback(() => {
        setFlowState({ kind: "input" });
        if (submitError) reset();
    }, [submitError, reset]);

    const clearSubmitError = useCallback(() => {
        if (submitError) reset();
    }, [submitError, reset]);

    const handleSubmit = useCallback(
        async (email: string) => {
            try {
                const result = await associateEmail(email);
                if (result.status === "conflict") {
                    setFlowState({
                        kind: "conflict",
                        email,
                        targetAuthenticatorId: result.authenticatorId,
                        targetWallet: result.wallet,
                    });
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
            <SuccessStep
                email={flowState.email}
                onBack={goToProfile}
                onSetupRecovery={() => {
                    // Recovery flow rework is still in flight, so this is
                    // intentionally a no-op for now.
                }}
            />
        );
    }

    if (flowState.kind === "merging") {
        if (!session?.authenticatorId) {
            // Lost session mid-flow — fall back to the conflict screen
            // which will steer the user to "use a different email" or
            // restart from the input step.
            return (
                <ConflictStep
                    targetAuthenticatorId={flowState.targetAuthenticatorId}
                    targetWallet={flowState.targetWallet}
                    onMerge={() => setFlowState({ kind: "input" })}
                    onUseDifferent={backToInput}
                    onBack={goToProfile}
                />
            );
        }
        return (
            <MergeFlow
                email={flowState.email}
                currentAuthenticatorId={session.authenticatorId}
                targetAuthenticatorId={flowState.targetAuthenticatorId}
                targetWallet={flowState.targetWallet}
                onAbort={() =>
                    setFlowState({
                        kind: "conflict",
                        email: flowState.email,
                        targetAuthenticatorId: flowState.targetAuthenticatorId,
                        targetWallet: flowState.targetWallet,
                    })
                }
                onCompleted={goToProfile}
            />
        );
    }

    if (flowState.kind === "conflict") {
        const canMerge = Boolean(
            flowState.targetAuthenticatorId && flowState.targetWallet
        );
        return (
            <ConflictStep
                targetAuthenticatorId={flowState.targetAuthenticatorId}
                targetWallet={flowState.targetWallet}
                onMerge={() => {
                    if (
                        !canMerge ||
                        !flowState.targetAuthenticatorId ||
                        !flowState.targetWallet
                    )
                        return;
                    setFlowState({
                        kind: "merging",
                        email: flowState.email,
                        targetAuthenticatorId: flowState.targetAuthenticatorId,
                        targetWallet: flowState.targetWallet,
                    });
                }}
                onUseDifferent={backToInput}
                onBack={goToProfile}
            />
        );
    }

    return (
        <EmailFormScreen
            title={t("wallet.addEmail.title")}
            description={t("wallet.addEmail.description")}
            label={t("wallet.addEmail.label")}
            placeholder={t("wallet.addEmail.placeholder")}
            clearAriaLabel={t("wallet.addEmail.clearAriaLabel")}
            submitLabel={t("wallet.addEmail.continue")}
            onBack={goToProfile}
            onSubmit={handleSubmit}
            isSubmitting={isAssociating}
            onEmailChange={clearSubmitError}
        >
            {submitError && (
                <Box role="alert" className={emailFormScreenStyles.inlineError}>
                    <Text variant="bodySmall" color="error">
                        {t("wallet.addEmail.submitError")}
                    </Text>
                </Box>
            )}
        </EmailFormScreen>
    );
}
