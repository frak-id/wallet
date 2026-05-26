import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { type Flow, startFlow } from "@frak-labs/wallet-shared";
import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";
import {
    type LoserAssetSummary,
    useLoserAssetSummary,
} from "../../hook/useLoserAssetSummary";
import { useMergePreview } from "../../hook/useMergePreview";
import { useLocalMergeStrategy } from "../../strategy/useLocalMergeStrategy";
import { useRemoteMergeStrategy } from "../../strategy/useRemoteMergeStrategy";
import { AssetMigrationStep } from "../AssetMigrationStep";
import { ConsentStep } from "../ConsentStep";
import { type DiscoveryResolution, DiscoveryStep } from "../DiscoveryStep";
import { PreviewStep } from "../PreviewStep";
import { type SettleRecoveryTarget, SettlingStep } from "../SettlingStep";
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
    | { kind: "migrate"; consentSignature: string }
    | { kind: "settling"; consentSignature: string }
    | { kind: "success" };

/**
 * Total non-terminal steps in the merge flow. Migrate is intentionally
 * counted under the same "4" as Sign so the indicator stays at "X/5"
 * regardless of whether the loser had funds to move — keeps the stepper
 * stable for the user and avoids the "1/?" flicker on Discovery (before
 * the asset summary has had a chance to resolve).
 */
const MERGE_STEP_TOTAL = 5;

const MERGE_STEP_NUMBER: Record<
    Exclude<Step["kind"], "success">,
    1 | 2 | 3 | 4 | 5
> = {
    discovery: 1,
    preview: 2,
    consent: 3,
    sign: 4,
    migrate: 4,
    settling: 5,
};

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
    const { t } = useTranslation();
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

    // Tear down on EVERY unmount, success included — `strategy.cancel`
    // also drops the detached pairing session snapshot, which would
    // otherwise survive a successful merge and leak into the next flow.
    // Aborts additionally cancel pending signature-requests so a late
    // peer reply doesn't land against the abandoned flow. No-op for the
    // local strategy (which exposes no `cancel`).
    useEffect(() => {
        return () => {
            strategy.cancel?.();
        };
    }, [strategy.cancel]);

    const handleAbort = useCallback(() => {
        strategy.cancel?.();
        onAbort();
    }, [onAbort, strategy.cancel]);

    const handleSettlingCompleted = useCallback(() => {
        flowRef.current?.end("succeeded", {
            last_step: "settling",
            requester_was_loser: needsSwitch === true,
        });
        setStep({ kind: "success" });
    }, [needsSwitch]);

    const handleDiscoveryResolved = useCallback(
        (resolved: DiscoveryResolution) => {
            setDiscovery(resolved);
            setStep({ kind: "preview" });
        },
        []
    );

    const stepIndicator = renderStepIndicator(t, step.kind);

    if (step.kind === "discovery") {
        return (
            <DiscoveryStep
                targetAuthenticatorIds={targetAuthenticatorIds}
                onResolved={handleDiscoveryResolved}
                onAbort={handleAbort}
                stepIndicator={stepIndicator}
            />
        );
    }

    if (step.kind === "success") {
        return <SuccessStep email={email} onBack={onCompleted} />;
    }

    if (preview.isLoading || !preview.data) {
        return (
            <PreviewGate
                isError={preview.isError}
                onRetry={() => preview.refetch()}
                onAbort={handleAbort}
                stepIndicator={stepIndicator}
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
                stepIndicator={stepIndicator}
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
                stepIndicator={stepIndicator}
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
        const consentSignature = step.consentSignature;
        return (
            <SignStep
                winner={preview.data.winner}
                winnerAuthenticatorId={winnerAuthenticatorId}
                winnerPublicKey={preview.data.winnerPublicKey}
                loserAuthenticatorId={preview.data.loserAuthenticatorId}
                loserPublicKey={preview.data.loserPublicKey}
                sendAddPassKey={strategy.sendAddPassKey}
                onSigned={() =>
                    setStep(
                        nextStepAfterSign(consentSignature, assetSummary.data)
                    )
                }
                onBack={() => setStep({ kind: "consent" })}
                onCancel={handleAbort}
                stepIndicator={stepIndicator}
            />
        );
    }

    if (step.kind === "migrate") {
        const consentSignature = step.consentSignature;
        return (
            <AssetMigrationStep
                loser={preview.data.loser}
                winner={preview.data.winner}
                loserAuthenticatorId={preview.data.loserAuthenticatorId}
                loserPublicKey={preview.data.loserPublicKey}
                summary={assetSummary}
                migrate={strategy.migrateLoserAssets}
                onCompleted={() =>
                    setStep({ kind: "settling", consentSignature })
                }
                onBack={() => setStep({ kind: "sign", consentSignature })}
                onCancel={handleAbort}
                stepIndicator={stepIndicator}
            />
        );
    }

    if (step.kind === "settling" && discovery) {
        const consentSignature = step.consentSignature;
        return (
            <SettlingStep
                targetAuthenticatorId={discovery.targetAuthenticatorId}
                loserConsentSignature={consentSignature}
                pairingId={strategy.pairingId}
                onCompleted={handleSettlingCompleted}
                onBack={() =>
                    setStep(
                        settlingBackStep(consentSignature, assetSummary.data)
                    )
                }
                onCancel={handleAbort}
                onRecover={(target) =>
                    setStep(settlingRecoveryStep(target, consentSignature))
                }
                stepIndicator={stepIndicator}
            />
        );
    }

    return null;
}

/**
 * Migrate is skipped entirely when the loser has no funds (see
 * `nextStepAfterSign`). Mirror that here so the back button lands on the
 * screen the user actually came from.
 */
function settlingBackStep(
    consentSignature: string,
    summary: LoserAssetSummary | null | undefined
): Step {
    if (summary?.hasFunds === false) return { kind: "sign", consentSignature };
    return { kind: "migrate", consentSignature };
}

function settlingRecoveryStep(
    target: SettleRecoveryTarget,
    consentSignature: string
): Step {
    if (target === "sign" || target === "migrate")
        return { kind: target, consentSignature };
    return { kind: target };
}

/**
 * Decide which step to move to once the addPassKey has been signed.
 * Skip Migrate entirely when the loser has already been drained — without
 * this guard the user sees an empty "Move your funds" CTA for one frame
 * before AssetMigrationStep's auto-advance effect kicks in. The migrate
 * screen keeps the same defence for the case where the summary resolves
 * between here and its own mount.
 */
function nextStepAfterSign(
    consentSignature: string,
    summary: LoserAssetSummary | null | undefined
): Step {
    if (summary && !summary.hasFunds)
        return { kind: "settling", consentSignature };
    return { kind: "migrate", consentSignature };
}

function renderStepIndicator(
    t: ReturnType<typeof useTranslation>["t"],
    kind: Step["kind"]
) {
    if (kind === "success") return null;
    return (
        <Text variant="bodySmall" color="secondary">
            {t("wallet.merge.stepIndicator", {
                current: MERGE_STEP_NUMBER[kind],
                total: MERGE_STEP_TOTAL,
            })}
        </Text>
    );
}

function PreviewGate({
    isError,
    onRetry,
    onAbort,
    stepIndicator,
}: {
    isError: boolean;
    onRetry: () => void;
    onAbort: () => void;
    stepIndicator?: ReactNode;
}) {
    const { t } = useTranslation();
    if (isError) {
        return (
            <EmailFlowResultScreen
                title={t("wallet.merge.preview.errorTitle")}
                description={t("wallet.merge.preview.errorDescription")}
                onBack={onAbort}
                headerCenter={stepIndicator}
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
            headerCenter={stepIndicator}
        />
    );
}
