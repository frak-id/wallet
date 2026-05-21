import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { selectSession, sessionStore } from "@frak-labs/wallet-shared";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";
import { useLoserAssetCheck } from "../../hook/useLoserAssetCheck";
import { useMergePreview } from "../../hook/useMergePreview";
import { AssetMigrationStep } from "../AssetMigrationStep";
import { ConsentStep } from "../ConsentStep";
import { FinalizeStep } from "../FinalizeStep";
import { PreviewStep } from "../PreviewStep";
import { SuccessStep } from "../SuccessStep";

type MergeFlowProps = {
    /** Email the user typed in the AddEmail input step. */
    email: string;
    /** Credential currently logged in — taken from the session. Kept on the
     *  props so the parent owns the "is the user signed in?" check. */
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
    | { kind: "finalize"; consentSignature: string }
    | { kind: "success" };

/**
 * Multi-step orchestrator for the same-device wallet-merge flow.
 *
 * Mounted from the AddEmail conflict branch once the user accepts the
 * "combine my accounts" CTA. Owns the small bits of cross-step state
 * (consent signature, settle result) and routes user-visible navigation
 * between the dedicated step screens.
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

    const preview = useMergePreview(targetAuthenticatorId);

    const session = useStore(sessionStore, selectSession);

    const assetCheck = useLoserAssetCheck({
        loser: preview.data?.loser,
    });

    const handleSettleSuccess = useCallback(() => {
        setStep({ kind: "success" });
    }, []);

    if (preview.isLoading || !preview.data) {
        if (preview.isError) {
            return (
                <EmailFlowResultScreen
                    title={t("wallet.merge.preview.errorTitle")}
                    description={t("wallet.merge.preview.errorDescription")}
                    onBack={onAbort}
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
            />
        );
    }

    // Guard: settle requires a live webauthn session. If the user lost the
    // session mid-flow (storage cleared, JWT expired), bail with a clear
    // message rather than crashing inside the finaliser.
    if (!session?.authenticatorId) {
        return (
            <EmailFlowResultScreen
                title={t("wallet.merge.preview.errorTitle")}
                description={t("wallet.merge.preview.errorDescription")}
                onBack={onAbort}
            >
                <Button
                    type="button"
                    variant="primary"
                    size="large"
                    width="full"
                    onClick={onAbort}
                >
                    {t("wallet.merge.preview.cancel")}
                </Button>
            </EmailFlowResultScreen>
        );
    }

    if (step.kind === "preview") {
        return (
            <PreviewStep
                preview={preview.data}
                email={email}
                onContinue={() => setStep({ kind: "assets" })}
                onCancel={onAbort}
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
                onConfirmed={(consentSignature) =>
                    setStep({ kind: "finalize", consentSignature })
                }
                onBack={() => setStep({ kind: "assets" })}
            />
        );
    }

    if (step.kind === "finalize") {
        return (
            <FinalizeStep
                preview={preview.data}
                currentAuthenticatorId={currentAuthenticatorId}
                targetAuthenticatorId={targetAuthenticatorId}
                loserConsentSignature={step.consentSignature}
                onComplete={() => handleSettleSuccess()}
                onCancel={onAbort}
            />
        );
    }

    return (
        <SuccessStep
            settle={{
                status: "merged",
                winner: preview.data.winner,
                loser: preview.data.loser,
            }}
            email={email}
            onBack={onCompleted}
        />
    );
}
