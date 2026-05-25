import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { type Flow, startFlow } from "@frak-labs/wallet-shared";
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
import { type DiscoveryResolution, DiscoveryStep } from "../DiscoveryStep";
import { PreviewStep } from "../PreviewStep";
import { SettlingStep } from "../SettlingStep";
import { SignStep } from "../SignStep";
import { SuccessStep } from "../SuccessStep";

type MergeFlowProps = {
    /** Email the user typed in the AddEmail input step. */
    email: string;
    /** Credential currently logged in — captured by the parent at flow entry. */
    currentAuthenticatorId: string;
    /**
     * Every credential currently bound to the conflicting wallet. The
     * full set is passed through to DiscoveryStep so both the local
     * probe (`allowCredentials`) and the pairing (`authenticatorHints`
     * server-side allow-list) can resolve via any of them.
     */
    targetAuthenticatorIds: string[];
    /** Bail out of the flow without merging — back to the conflict screen. */
    onAbort: () => void;
    /** Merge finished successfully — typically navigates back to profile. */
    onCompleted: () => void;
};

type Step =
    | { kind: "discovery" }
    | { kind: "preview" }
    | { kind: "consent" }
    | { kind: "sign"; consentSignature: string }
    | { kind: "migrate"; consentSignature: string; addPassKeyTxHash?: Hex }
    | { kind: "settling"; consentSignature: string; txHash?: Hex }
    | { kind: "success" };

/**
 * Multi-step orchestrator for the wallet-merge flow.
 *
 * Each user-visible step is a self-contained screen owning at most one
 * webauthn prompt. The merge owns its own bundler clients (winner +
 * loser) via the active strategy, so the live wagmi session is never
 * mutated — the consent, addPassKey, and migration userOps each sign
 * with the appropriate credential through either the local WebAuthn
 * ceremony or the merge's origin pairing, never by swapping the live
 * session.
 *
 * Step ordering, animations, copy, and back-navigation are identical
 * between local and remote — only what happens inside each mutation
 * differs, encapsulated by the `MergeStrategy` chosen on `mode`.
 */
export function MergeFlow({
    email,
    currentAuthenticatorId,
    targetAuthenticatorIds,
    onAbort,
    onCompleted,
}: MergeFlowProps) {
    const [step, setStep] = useState<Step>({ kind: "discovery" });
    // Set by DiscoveryStep once the user's chosen path resolves. `null`
    // while the race is in progress; preview / strategy selection both
    // gate on this so neither runs before we know the mode + the cred id
    // we're merging with.
    const [discovery, setDiscovery] = useState<DiscoveryResolution | null>(
        null
    );
    // Held in a ref so the unmount cleanup below reads the latest step kind
    // without re-binding the effect every transition. The same ref feeds
    // the analytics `last_step` field on abandoned flows.
    const stepKindRef = useRef(step.kind);
    stepKindRef.current = step.kind;

    // Funnel: started once discovery resolves (the mode isn't known
    // before that), ended as `succeeded` from the settling onCompleted
    // callback below, ended as `abandoned` from this unmount cleanup.
    // Abandonments during discovery (before a mode is chosen) intentionally
    // don't fire a funnel event — `wallet_merge_started` requires a known
    // mode and a discovery-only abandonment isn't a meaningful drop-off.
    const flowRef = useRef<Flow<"wallet_merge"> | undefined>(undefined);
    useEffect(() => {
        if (!discovery) return;
        const flow = startFlow("wallet_merge", { mode: discovery.mode });
        flowRef.current = flow;
        return () => {
            if (flow.ended) return;
            flow.end("abandoned", { last_step: stepKindRef.current });
        };
    }, [discovery]);

    const preview = useMergePreview(
        discovery?.targetAuthenticatorId,
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
        if (needsSwitch === undefined || !discovery) return undefined;
        return needsSwitch
            ? discovery.targetAuthenticatorId
            : currentAuthenticatorId;
    }, [needsSwitch, discovery, currentAuthenticatorId]);

    // Both strategies must run unconditionally to honour the rules of hooks;
    // the one we use is picked off `discovery.mode`. Each strategy calls its
    // own React Query hooks INTERNALLY and exposes the resulting mutation
    // objects as plain fields — we read them as data, never re-invoke them,
    // so the count of hook calls inside this component stays stable across
    // a mode switch. Before discovery resolves we default to `localStrategy`
    // (harmless — only DiscoveryStep is rendered and it doesn't read it).
    const localStrategy = useLocalMergeStrategy();
    const remoteStrategy = useRemoteMergeStrategy({
        needsSwitch,
        winnerAuthenticatorId,
        loserAuthenticatorId: preview.data?.loserAuthenticatorId,
    });
    const strategy =
        discovery?.mode === "remote" ? remoteStrategy : localStrategy;

    // Tear down on every non-success unmount: cancel any in-flight pairing
    // handshake. Matters for the cross-device flow — `softReset` clears
    // pending signature-requests so a late peer reply doesn't apply to a
    // flow the user has already aborted. No-op for the local strategy.
    useEffect(() => {
        return () => {
            if (stepKindRef.current === "success") return;
            strategy.cancel?.();
        };
    }, [strategy.cancel]);

    const handleAbort = useCallback(() => {
        strategy.cancel?.();
        onAbort();
    }, [onAbort, strategy.cancel]);

    if (step.kind === "discovery") {
        return (
            <DiscoveryStep
                targetAuthenticatorIds={targetAuthenticatorIds}
                onResolved={(resolved) => {
                    setDiscovery(resolved);
                    setStep({ kind: "preview" });
                }}
                onAbort={handleAbort}
            />
        );
    }

    if (preview.isLoading || !preview.data) {
        return (
            <PreviewGate
                isError={preview.isError}
                onRetry={() => preview.refetch()}
                onAbort={handleAbort}
            />
        );
    }

    if (step.kind === "preview") {
        return (
            <PreviewStep
                preview={preview.data}
                email={email}
                assetSummary={assetSummary.data ?? null}
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
                onConfirmed={(consentSignature) =>
                    setStep({ kind: "sign", consentSignature })
                }
                onBack={() => setStep({ kind: "preview" })}
                consent={strategy.loserConsent}
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

    if (step.kind === "sign") {
        if (!winnerAuthenticatorId || !preview.data.winnerPublicKey) {
            // Should never hit — `winnerAuthenticatorId` is derived from a
            // resolved preview, and `winnerPublicKey` is part of the same
            // preview payload. Keeps the type narrowing tight without
            // adding a runtime branch the user would ever see.
            return null;
        }
        return (
            <SignStep
                winner={preview.data.winner}
                winnerAuthenticatorId={winnerAuthenticatorId}
                winnerPublicKey={preview.data.winnerPublicKey}
                loserAuthenticatorId={preview.data.loserAuthenticatorId}
                loserPublicKey={preview.data.loserPublicKey}
                sendAddPassKey={strategy.sendAddPassKey}
                onSigned={(txHash) => {
                    // Skip the migrate step entirely when the loser has
                    // already been drained — otherwise we render a "Move
                    // your funds" CTA over an empty list for one frame
                    // before `AssetMigrationStep`'s auto-advance effect
                    // kicks in. AssetMigrationStep keeps the same defence
                    // for the case where the summary resolves between
                    // here and its mount.
                    const summary = assetSummary.data;
                    if (summary && !summary.hasFunds) {
                        setStep({
                            kind: "settling",
                            consentSignature: step.consentSignature,
                            txHash,
                        });
                        return;
                    }
                    setStep({
                        kind: "migrate",
                        consentSignature: step.consentSignature,
                        addPassKeyTxHash: txHash,
                    });
                }}
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
                summary={assetSummary}
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

    if (step.kind === "settling" && discovery) {
        return (
            <SettlingStep
                targetAuthenticatorId={discovery.targetAuthenticatorId}
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

function PreviewGate({
    isError,
    onRetry,
    onAbort,
}: {
    isError: boolean;
    onRetry: () => void;
    onAbort: () => void;
}) {
    const { t } = useTranslation();
    if (isError) {
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
                    onClick={onRetry}
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
