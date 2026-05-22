import type { MergeSettleResponse } from "@frak-labs/backend-elysia/api/schemas";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { sessionStore } from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Hex } from "viem";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";
import { useLoserAssetCheck } from "../../hook/useLoserAssetCheck";
import { useMergePreview } from "../../hook/useMergePreview";
import { AssetMigrationStep } from "../AssetMigrationStep";
import { ConsentStep } from "../ConsentStep";
import { PreviewStep } from "../PreviewStep";
import { SettlingStep } from "../SettlingStep";
import { SignStep } from "../SignStep";
import { SuccessStep } from "../SuccessStep";
import { SwitchStep } from "../SwitchStep";

type MergeFlowProps = {
    /** Email the user typed in the AddEmail input step. */
    email: string;
    /** Credential currently logged in — captured by the parent at flow
     *  entry and held constant for the lifetime of the flow. We deliberately
     *  do **not** read it from the live session store: the SwitchStep
     *  temporarily swaps the live session and we still need to know who the
     *  original credential was to compute `needsSwitch` and to pick the
     *  winner credential id later. */
    currentAuthenticatorId: string;
    /** The conflicting credential identified by the AddEmail backend. */
    targetAuthenticatorId: string;
    /** Bail out of the flow without merging — back to the conflict screen. */
    onAbort: () => void;
    /** Merge finished successfully — typically navigates back to profile. */
    onCompleted: () => void;
};

type Step =
    | { kind: "preview" }
    | { kind: "assets" }
    | { kind: "consent" }
    | { kind: "switch"; consentSignature: string }
    | { kind: "sign"; consentSignature: string }
    | { kind: "settling"; consentSignature: string; txHash?: Hex }
    | { kind: "success"; settle: MergeSettleResponse };

/**
 * Multi-step orchestrator for the same-device wallet-merge flow.
 *
 * Each user-visible step is a self-contained screen owning at most one
 * webauthn prompt, so the three biometric prompts the same-device merge
 * needs (loser consent → winner login → addPassKey signing) are explicitly
 * sequenced — never fired back-to-back from a single screen. The cross-step
 * state held here is intentionally narrow: the consent signature, the
 * post-sign tx hash, and the terminal settle response.
 */
export function MergeFlow({
    email,
    currentAuthenticatorId,
    targetAuthenticatorId,
    onAbort,
    onCompleted,
}: MergeFlowProps) {
    const { t } = useTranslation();
    const [step, setStep] = useState<Step>({ kind: "preview" });
    // Held in a ref so the unmount cleanup below reads the latest step kind
    // without re-binding the effect every transition.
    const stepKindRef = useRef(step.kind);
    stepKindRef.current = step.kind;

    const preview = useMergePreview(targetAuthenticatorId);

    const assetCheck = useLoserAssetCheck({
        loser: preview.data?.loser,
    });

    // Two-layer parked-session cleanup so the user never gets stranded on
    // the winner session after an unhappy path:
    //
    //  1. On mount: pop any orphan snapshot left over by a prior tab session
    //     that crashed mid-flow. AddEmail's flow state itself is React-only
    //     and resets on refresh, so a parked snapshot at this point is by
    //     definition stale — its real owner is gone. Within the same React
    //     session the unmount cleanup below already popped, so this branch
    //     is a no-op for the common case.
    //  2. On unmount: pop unless we landed on the terminal success step,
    //     which has already popped via `useMergeSettle`. Covers user-driven
    //     aborts (cancel button, back navigation), AddEmail flipping back
    //     to the conflict screen, and route-level unmounts.
    //
    // `popSession` is a no-op when nothing is parked, so both layers are
    // safe to call unconditionally.
    useEffect(() => {
        sessionStore.getState().popSession();
        return () => {
            if (stepKindRef.current === "success") return;
            sessionStore.getState().popSession();
        };
    }, []);

    const handleAbort = useCallback(() => {
        sessionStore.getState().popSession();
        onAbort();
    }, [onAbort]);

    const needsSwitch = useMemo(() => {
        if (!preview.data) return false;
        return (
            preview.data.winner.toLowerCase() !==
            preview.data.requesterWallet.toLowerCase()
        );
    }, [preview.data]);

    const winnerAuthenticatorId = needsSwitch
        ? targetAuthenticatorId
        : currentAuthenticatorId;

    const handleConsentConfirmed = useCallback(
        (consentSignature: string) => {
            setStep(
                needsSwitch
                    ? { kind: "switch", consentSignature }
                    : { kind: "sign", consentSignature }
            );
        },
        [needsSwitch]
    );

    if (preview.isLoading || !preview.data) {
        if (preview.isError) {
            return (
                <EmailFlowResultScreen
                    title={t("wallet.merge.preview.errorTitle")}
                    description={t("wallet.merge.preview.errorDescription")}
                    onBack={handleAbort}
                >
                    <Button
                        type="button"
                        variant="primary"
                        size="large"
                        width="full"
                        onClick={() => preview.refetch()}
                    >
                        {t("wallet.merge.preview.errorRetry")}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="large"
                        width="full"
                        onClick={handleAbort}
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
                onBack={handleAbort}
            />
        );
    }

    if (step.kind === "preview") {
        return (
            <PreviewStep
                preview={preview.data}
                email={email}
                onContinue={() => setStep({ kind: "assets" })}
                onCancel={handleAbort}
            />
        );
    }

    if (step.kind === "assets") {
        return (
            <AssetMigrationStep
                loser={preview.data.loser}
                winner={preview.data.winner}
                assets={assetCheck}
                onContinue={() => setStep({ kind: "consent" })}
                onBack={() => setStep({ kind: "preview" })}
            />
        );
    }

    if (step.kind === "consent") {
        return (
            <ConsentStep
                winner={preview.data.winner}
                loserAuthenticatorId={preview.data.loserAuthenticatorId}
                onConfirmed={handleConsentConfirmed}
                onBack={() => setStep({ kind: "assets" })}
            />
        );
    }

    if (step.kind === "switch") {
        return (
            <SwitchStep
                winnerWallet={preview.data.winner}
                winnerAuthenticatorId={winnerAuthenticatorId}
                onSwitched={() =>
                    setStep({
                        kind: "sign",
                        consentSignature: step.consentSignature,
                    })
                }
                onBack={() => setStep({ kind: "consent" })}
            />
        );
    }

    if (step.kind === "sign") {
        return (
            <SignStep
                loserAuthenticatorId={preview.data.loserAuthenticatorId}
                loserPublicKey={preview.data.loserPublicKey}
                onSigned={(txHash) =>
                    setStep({
                        kind: "settling",
                        consentSignature: step.consentSignature,
                        txHash,
                    })
                }
                onCancel={handleAbort}
            />
        );
    }

    if (step.kind === "settling") {
        return (
            <SettlingStep
                loserAuthenticatorId={preview.data.loserAuthenticatorId}
                onChainTxHash={step.txHash}
                loserConsentSignature={step.consentSignature}
                onCompleted={(settle) => setStep({ kind: "success", settle })}
                onCancel={handleAbort}
            />
        );
    }

    return (
        <SuccessStep settle={step.settle} email={email} onBack={onCompleted} />
    );
}
