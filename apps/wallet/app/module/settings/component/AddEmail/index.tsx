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
          /**
           * Every credential currently bound to the conflicting wallet. Empty
           * when the backend resolved a wallet but no active binding on the
           * current chain (legacy / cross-env). The merge target is the
           * first id of this list — picked arbitrarily but deterministically,
           * since any binding repoints to the same wallet on settle.
           */
          targetAuthenticatorIds: string[];
          targetWallet?: Address;
      }
    | {
          kind: "merging";
          email: string;
          /** Credential the user was signed in as when they entered the
           *  merge flow. Snapshotted here so MergeFlow can derive
           *  winner/loser without depending on a session that may shift
           *  outside the flow's control. */
          currentAuthenticatorId: string;
          targetAuthenticatorId: string;
          targetWallet: Address;
          /**
           * `"local"` when the user picked "Combine accounts" (both passkeys
           * on this device). `"remote"` when they picked "Use my other
           * device" (one passkey lives on the device that scans the QR).
           * Threaded straight through to {@link MergeFlow}.
           */
          mode: "local" | "remote";
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
                        targetAuthenticatorIds: result.authenticatorIds,
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
        // `currentAuthenticatorId` is captured from the session at flow
        // entry (see the `onMerge` handler below) and held on the flow
        // state for the lifetime of the merge. We deliberately do **not**
        // re-read it from the live session here: keeping it stable lets
        // MergeFlow derive winner/loser invariants without re-resolving
        // them every render.
        return (
            <MergeFlow
                email={flowState.email}
                currentAuthenticatorId={flowState.currentAuthenticatorId}
                targetAuthenticatorId={flowState.targetAuthenticatorId}
                mode={flowState.mode}
                onAbort={() =>
                    setFlowState({
                        kind: "conflict",
                        email: flowState.email,
                        // Resurface the single merge-target id as the
                        // single-element array the conflict branch expects.
                        // The original list is not preserved across the merge
                        // step (we only retained the chosen one), and the
                        // login path on this branch is unused — ConflictStep
                        // only needs `targetAuthenticatorIds[0]` for the
                        // merge CTA.
                        targetAuthenticatorIds: [
                            flowState.targetAuthenticatorId,
                        ],
                        targetWallet: flowState.targetWallet,
                    })
                }
                onCompleted={goToProfile}
            />
        );
    }

    if (flowState.kind === "conflict") {
        // Merge target is the first cred bound to the conflicting wallet —
        // any active binding on that wallet repoints onto the winner, so the
        // specific choice doesn't matter on settle. Deterministic via the
        // server-side `ORDER BY binding id` ensures retries hit the same id.
        const targetAuthenticatorId = flowState.targetAuthenticatorIds[0];
        const canMerge = Boolean(
            targetAuthenticatorId &&
                flowState.targetWallet &&
                session?.authenticatorId
        );
        const startMerge = (mode: "local" | "remote") => {
            if (
                !canMerge ||
                !targetAuthenticatorId ||
                !flowState.targetWallet ||
                !session?.authenticatorId
            )
                return;
            setFlowState({
                kind: "merging",
                email: flowState.email,
                currentAuthenticatorId: session.authenticatorId,
                targetAuthenticatorId,
                targetWallet: flowState.targetWallet,
                mode,
            });
        };
        return (
            <ConflictStep
                targetAuthenticatorId={targetAuthenticatorId}
                targetWallet={flowState.targetWallet}
                onMerge={() => startMerge("local")}
                onMergeRemote={() => startMerge("remote")}
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
