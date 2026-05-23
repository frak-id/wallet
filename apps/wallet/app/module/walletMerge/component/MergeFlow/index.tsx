import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { type Flow, sessionStore, startFlow } from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Hex } from "viem";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";
import { useLoserAssetSummary } from "../../hook/useLoserAssetSummary";
import { useMergePreview } from "../../hook/useMergePreview";
import { useLocalMergeStrategy } from "../../strategy/useLocalMergeStrategy";
import { useRemoteMergeStrategy } from "../../strategy/useRemoteMergeStrategy";
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
    /**
     * `"local"` — same-device merge (default; both passkeys on this device).
     * `"remote"` — cross-device merge through pairing (one passkey lives on
     * another device, identified by `targetAuthenticatorId`).
     */
    mode: "local" | "remote";
    /** Bail out of the flow without merging — back to the conflict screen. */
    onAbort: () => void;
    /** Merge finished successfully — typically navigates back to profile. */
    onCompleted: () => void;
};

type Step =
    | { kind: "preview" }
    | { kind: "consent" }
    | { kind: "switch"; consentSignature: string }
    | { kind: "sign"; consentSignature: string }
    | { kind: "migrate"; consentSignature: string; addPassKeyTxHash?: Hex }
    | { kind: "settling"; consentSignature: string; txHash?: Hex }
    | { kind: "success" };

/**
 * Multi-step orchestrator for the wallet-merge flow.
 *
 * Each user-visible step is a self-contained screen owning at most one
 * webauthn prompt, so the three biometric prompts the same-device merge
 * needs (loser consent → winner login → addPassKey signing) are explicitly
 * sequenced — never fired back-to-back from a single screen. The cross-step
 * state held here is intentionally narrow: the consent signature and the
 * post-sign tx hash.
 *
 * The same-device vs cross-device behaviour is encapsulated by the
 * `MergeStrategy` chosen on `mode`. Step ordering, animations, copy, and
 * back-navigation are identical between the two — only what happens inside
 * the consent / switch mutations differs.
 */
export function MergeFlow({
    email,
    currentAuthenticatorId,
    targetAuthenticatorId,
    mode,
    onAbort,
    onCompleted,
}: MergeFlowProps) {
    const { t } = useTranslation();
    const [step, setStep] = useState<Step>({ kind: "preview" });
    // Held in a ref so the unmount cleanup below reads the latest step kind
    // without re-binding the effect every transition. The same ref feeds
    // the analytics `last_step` field on abandoned flows.
    const stepKindRef = useRef(step.kind);
    stepKindRef.current = step.kind;

    // Funnel: started on mount, ended as `succeeded` from the settling
    // onCompleted callback below, ended as `abandoned` from this unmount
    // cleanup. No `failed` outcome — coded settle errors are recoverable
    // in-flow (see SettlingStep.onRecover) so abandons carry the
    // diagnostic via `last_step`.
    const flowRef = useRef<Flow<"wallet_merge"> | undefined>(undefined);
    useEffect(() => {
        const flow = startFlow("wallet_merge", { mode });
        flowRef.current = flow;
        return () => {
            if (flow.ended) return;
            flow.end("abandoned", { last_step: stepKindRef.current });
        };
    }, [mode]);

    const preview = useMergePreview(
        targetAuthenticatorId,
        currentAuthenticatorId
    );

    const assetSummary = useLoserAssetSummary({
        loser: preview.data?.loser,
    });

    const needsSwitch = useMemo(() => {
        if (!preview.data) return undefined;
        return (
            preview.data.winner.toLowerCase() !==
            preview.data.requesterWallet.toLowerCase()
        );
    }, [preview.data]);

    const winnerAuthenticatorId = useMemo(() => {
        if (needsSwitch === undefined) return undefined;
        return needsSwitch ? targetAuthenticatorId : currentAuthenticatorId;
    }, [needsSwitch, targetAuthenticatorId, currentAuthenticatorId]);

    // Both strategies must run unconditionally to honour the rules of hooks;
    // the one we use is picked off `mode`. Each strategy calls its own
    // React Query hooks INTERNALLY and exposes the resulting mutation
    // objects as plain fields — we read them as data, never re-invoke them,
    // so the count of hook calls inside this component stays stable across
    // a `mode` switch.
    const localStrategy = useLocalMergeStrategy();
    const remoteStrategy = useRemoteMergeStrategy({
        needsSwitch,
        winnerAuthenticatorId,
        loserAuthenticatorId: preview.data?.loserAuthenticatorId,
    });
    const strategy = mode === "remote" ? remoteStrategy : localStrategy;

    const consent = strategy.loserConsent;
    const switchToWinner = strategy.switchToWinner;

    // Tear down on every non-success unmount: cancel any in-flight pairing
    // handshake and restore the parked session. Cancelling the pairing
    // matters most for the cross-device flow — a late `authenticated`
    // event arriving after the user aborted would otherwise apply a
    // distant session to the live slot. `popSession` handles user-driven
    // aborts, AddEmail flipping back to the conflict screen, and
    // route-level unmounts. Both ops are no-ops when there's nothing to
    // clean up.
    //
    // No mount-side pop: orphan snapshots from a crashed tab would have to
    // be cleaned by their real owner anyway, and a blind pop on mount can
    // clobber an unrelated flow's snapshot (e.g. pairing.tsx parked one
    // before the user navigated here).
    //
    // `strategy.cancel` is a stable reference (useCallback for remote,
    // undefined for local) so this effect's dep list never invalidates
    // during a flow's lifetime.
    useEffect(() => {
        return () => {
            if (stepKindRef.current === "success") return;
            strategy.cancel?.();
            sessionStore.getState().popSession();
        };
    }, [strategy.cancel]);

    const handleAbort = useCallback(() => {
        strategy.cancel?.();
        sessionStore.getState().popSession();
        onAbort();
    }, [onAbort, strategy.cancel]);

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
                assetSummary={assetSummary.data}
                onContinue={() => setStep({ kind: "consent" })}
                onCancel={handleAbort}
            />
        );
    }

    if (step.kind === "consent") {
        return (
            <ConsentStep
                winner={preview.data.winner}
                loserAuthenticatorId={preview.data.loserAuthenticatorId}
                onConfirmed={handleConsentConfirmed}
                onBack={() => setStep({ kind: "preview" })}
                consent={consent}
                strategy={strategy}
                /**
                 * Remote consent is only mobile-driven when the desktop is
                 * the winner (loser passkey lives on mobile). When desktop
                 * is the loser the consent is signed locally with the loser
                 * passkey on this device, identical to the same-device flow.
                 */
                remoteConsent={
                    strategy.mode === "remote" && needsSwitch === false
                }
            />
        );
    }

    if (step.kind === "switch") {
        return (
            <SwitchStep
                winnerWallet={preview.data.winner}
                winnerAuthenticatorId={
                    winnerAuthenticatorId ?? targetAuthenticatorId
                }
                onSwitched={() =>
                    setStep({
                        kind: "sign",
                        consentSignature: step.consentSignature,
                    })
                }
                onBack={() => setStep({ kind: "consent" })}
                switchAuth={switchToWinner}
                strategy={strategy}
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
                        kind: "migrate",
                        consentSignature: step.consentSignature,
                        addPassKeyTxHash: txHash,
                    })
                }
                onCancel={handleAbort}
            />
        );
    }

    if (step.kind === "migrate") {
        return (
            <AssetMigrationStep
                loser={preview.data.loser}
                winner={preview.data.winner}
                loserAuthenticatorId={preview.data.loserAuthenticatorId}
                loserPublicKey={preview.data.loserPublicKey}
                summary={assetSummary.data}
                migrate={strategy.migrateLoserAssets}
                onCompleted={() =>
                    setStep({
                        kind: "settling",
                        consentSignature: step.consentSignature,
                        txHash: step.addPassKeyTxHash,
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
                pairingId={strategy.pairingId}
                onCompleted={() => {
                    flowRef.current?.end("succeeded", {
                        last_step: "settling",
                        requester_was_loser: needsSwitch === true,
                    });
                    setStep({ kind: "success" });
                }}
                onCancel={handleAbort}
                onRecover={(target) => {
                    if (target === "sign") {
                        setStep({
                            kind: "sign",
                            consentSignature: step.consentSignature,
                        });
                    } else if (target === "consent") {
                        setStep({ kind: "consent" });
                    } else {
                        setStep({ kind: "preview" });
                    }
                }}
            />
        );
    }

    return <SuccessStep email={email} onBack={onCompleted} />;
}
