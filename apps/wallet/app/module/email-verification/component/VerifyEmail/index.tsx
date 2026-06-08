import { EMAIL_VERIFICATION } from "@frak-labs/app-essentials/constants/emailVerification";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CodeInput,
    selectSession,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { useStore } from "zustand";
import { useCurrentEmail } from "@/module/authentication/hook/useCurrentEmail";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";
import {
    EmailFormScreen,
    emailFormScreenStyles,
} from "@/module/common/component/EmailFormScreen";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { useSendEmailVerification } from "@/module/email-verification/hook/useSendEmailVerification";
import { useVerifyEmailCode } from "@/module/email-verification/hook/useVerifyEmailCode";
import { ConflictStep } from "@/module/settings/component/AddEmail/ConflictStep";
import { MergeFlow } from "@/module/walletMerge/component/MergeFlow";

const CODE_LENGTH = EMAIL_VERIFICATION.CODE_LENGTH;

type FlowState =
    | { kind: "verify" }
    | { kind: "changeEmail" }
    | {
          kind: "conflict";
          email: string;
          targetAuthenticatorIds: string[];
          targetWallet?: Address;
      }
    | {
          kind: "merging";
          email: string;
          currentAuthenticatorId: string;
          targetAuthenticatorIds: string[];
          targetWallet: Address;
      }
    | { kind: "success"; email: string };

type VerifyEmailProps = {
    /** Code lifted from the magic-link URL hash; auto-submitted once on mount. */
    initialCode?: string;
};

function resolveVerifyErrorKey(mutation: {
    data?: { status: string };
    isError: boolean;
}): string | undefined {
    const status = mutation.data?.status;
    if (
        status &&
        status !== "verified" &&
        status !== "alreadyVerified" &&
        // `conflict` is not an inline error — it hands off to the merge flow.
        status !== "conflict"
    ) {
        return status;
    }
    if (mutation.isError) return "network";
    return undefined;
}

function shouldShowAutoVerifyLoading(params: {
    initialCode?: string;
    verifyErrorKey?: string;
    isPending: boolean;
    hasData: boolean;
    isError: boolean;
}): boolean {
    if (!params.initialCode || params.verifyErrorKey) return false;
    return params.isPending || (!params.hasData && !params.isError);
}

function resolveTargetEmail(
    targetEmail: string | undefined,
    emailStatus:
        | { email?: string | null; pendingEmail?: string | null }
        | undefined
): string {
    return targetEmail ?? emailStatus?.pendingEmail ?? emailStatus?.email ?? "";
}

/**
 * The "this address belongs to another wallet" screen, reached from a send- or
 * verify-time conflict. Extracted so the merge-gating logic lives outside the
 * main flow component.
 */
function ConflictResolutionStep({
    conflict,
    currentAuthenticatorId,
    onStartMerge,
    onUseDifferent,
    onBack,
}: {
    conflict: Extract<FlowState, { kind: "conflict" }>;
    currentAuthenticatorId?: string;
    onStartMerge: (merge: Extract<FlowState, { kind: "merging" }>) => void;
    onUseDifferent: () => void;
    onBack: () => void;
}) {
    const { targetAuthenticatorIds, targetWallet, email } = conflict;
    const canMerge = Boolean(
        targetAuthenticatorIds.length && targetWallet && currentAuthenticatorId
    );
    const startMerge = () => {
        if (!canMerge || !targetWallet || !currentAuthenticatorId) return;
        onStartMerge({
            kind: "merging",
            email,
            currentAuthenticatorId,
            targetAuthenticatorIds,
            targetWallet,
        });
    };
    return (
        <ConflictStep
            canMerge={canMerge}
            onMerge={startMerge}
            onUseDifferent={onUseDifferent}
            onBack={onBack}
        />
    );
}

export function VerifyEmail({ initialCode }: VerifyEmailProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const session = useStore(sessionStore, selectSession);
    const { data: emailStatus } = useCurrentEmail();
    const {
        sendCode,
        isSending,
        cooldownSeconds,
        error: sendError,
        reset: resetSend,
        data: sendData,
    } = useSendEmailVerification();
    const verifyMutation = useVerifyEmailCode();

    const [flowState, setFlowState] = useState<FlowState>({ kind: "verify" });
    const [code, setCode] = useState("");
    const [targetEmail, setTargetEmail] = useState<string | undefined>();
    const autoVerifiedRef = useRef(false);

    const goToProfile = useCallback(() => {
        navigate({ to: "/profile" });
    }, [navigate]);

    const handleVerify = useCallback(
        async (value: string) => {
            try {
                const result = await verifyMutation.mutateAsync(value);
                if (
                    result.status === "verified" ||
                    result.status === "alreadyVerified"
                ) {
                    setFlowState({ kind: "success", email: result.email });
                    return;
                }
                // The address was claimed by another group between send and
                // verify — hand off to the same merge flow as a send conflict.
                if (result.status === "conflict") {
                    setFlowState({
                        kind: "conflict",
                        email: resolveTargetEmail(targetEmail, emailStatus),
                        targetAuthenticatorIds: result.authenticatorIds,
                        targetWallet: result.wallet,
                    });
                }
            } catch {
                // Network failure is surfaced via `verifyErrorKey`; nothing to
                // do here beyond swallowing the rejection.
            }
        },
        [verifyMutation.mutateAsync, targetEmail, emailStatus]
    );

    // Magic-link path: a `#code` in the URL auto-submits once before the user
    // touches anything; a failure simply drops to the manual-entry form.
    useEffect(() => {
        if (!initialCode || autoVerifiedRef.current) return;
        autoVerifiedRef.current = true;
        void handleVerify(initialCode);
    }, [initialCode, handleVerify]);

    const verifyErrorKey = resolveVerifyErrorKey(verifyMutation);

    const handleSendCurrent = useCallback(async () => {
        verifyMutation.reset();
        // Resend to the address actually being verified. Passing the pending
        // rotation target explicitly (rather than letting the server fall back
        // to the current email) keeps a resend after the rotation code expired
        // from silently retargeting the old, already-verified address.
        await sendCode(targetEmail ?? emailStatus?.pendingEmail ?? undefined);
    }, [sendCode, targetEmail, emailStatus, verifyMutation.reset]);

    const handleChangeEmailSubmit = useCallback(
        async (email: string) => {
            try {
                const result = await sendCode(email);
                if (result.status === "conflict") {
                    setFlowState({
                        kind: "conflict",
                        email,
                        targetAuthenticatorIds: result.authenticatorIds,
                        targetWallet: result.wallet,
                    });
                    return;
                }
                // Retired address: not reusable. The inline banner reads off
                // the mutation result, so just stay on the change-email form.
                if (result.status === "unavailable") {
                    return;
                }
                setTargetEmail(email);
                setCode("");
                verifyMutation.reset();
                setFlowState({ kind: "verify" });
            } catch {
                // Surfaced via `sendError` so the user can retry from the form.
            }
        },
        [sendCode, verifyMutation]
    );

    if (flowState.kind === "success") {
        return (
            <EmailFlowResultScreen
                title={t("wallet.verifyEmail.success.title")}
                description={t("wallet.verifyEmail.success.description", {
                    email: flowState.email,
                })}
                onBack={goToProfile}
            >
                <Button
                    type="button"
                    variant="primary"
                    size="large"
                    width="full"
                    onClick={() => navigate({ to: "/profile/recovery" })}
                >
                    {t("wallet.verifyEmail.success.setupRecovery")}
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    size="large"
                    width="full"
                    onClick={goToProfile}
                >
                    {t("wallet.verifyEmail.success.back")}
                </Button>
            </EmailFlowResultScreen>
        );
    }

    if (flowState.kind === "merging") {
        return (
            <MergeFlow
                email={flowState.email}
                currentAuthenticatorId={flowState.currentAuthenticatorId}
                targetAuthenticatorIds={flowState.targetAuthenticatorIds}
                onAbort={() =>
                    setFlowState({
                        kind: "conflict",
                        email: flowState.email,
                        targetAuthenticatorIds:
                            flowState.targetAuthenticatorIds,
                        targetWallet: flowState.targetWallet,
                    })
                }
                onCompleted={goToProfile}
            />
        );
    }

    if (flowState.kind === "conflict") {
        return (
            <ConflictResolutionStep
                conflict={flowState}
                currentAuthenticatorId={session?.authenticatorId}
                onStartMerge={setFlowState}
                onUseDifferent={() => setFlowState({ kind: "changeEmail" })}
                onBack={goToProfile}
            />
        );
    }

    if (flowState.kind === "changeEmail") {
        return (
            <EmailFormScreen
                title={t("wallet.verifyEmail.changeEmail.title")}
                description={t("wallet.verifyEmail.changeEmail.description")}
                label={t("wallet.verifyEmail.changeEmail.label")}
                placeholder={t("wallet.verifyEmail.changeEmail.placeholder")}
                clearAriaLabel={t(
                    "wallet.verifyEmail.changeEmail.clearAriaLabel"
                )}
                submitLabel={t("wallet.verifyEmail.changeEmail.continue")}
                onBack={() => setFlowState({ kind: "verify" })}
                onSubmit={handleChangeEmailSubmit}
                isSubmitting={isSending}
                submitDisabled={sendData?.status === "unavailable"}
                onEmailChange={() => resetSend()}
            >
                {sendData?.status === "unavailable" && (
                    <Box
                        role="alert"
                        className={emailFormScreenStyles.inlineError}
                    >
                        <Text variant="bodySmall" color="error">
                            {t("wallet.verifyEmail.changeEmail.alreadyUsed")}
                        </Text>
                    </Box>
                )}
                {sendError && (
                    <Box
                        role="alert"
                        className={emailFormScreenStyles.inlineError}
                    >
                        <Text variant="bodySmall" color="error">
                            {t("wallet.verifyEmail.error.send")}
                        </Text>
                    </Box>
                )}
            </EmailFormScreen>
        );
    }

    const displayEmail = resolveTargetEmail(targetEmail, emailStatus);
    const isRotation = Boolean(
        emailStatus?.verified &&
            displayEmail &&
            displayEmail !== emailStatus.email
    );

    const isAutoVerifying = shouldShowAutoVerifyLoading({
        initialCode,
        verifyErrorKey,
        isPending: verifyMutation.isPending,
        hasData: !!verifyMutation.data,
        isError: verifyMutation.isError,
    });
    if (isAutoVerifying) {
        return (
            <EmailFlowResultScreen
                title={t("wallet.verifyEmail.verifying.title")}
                description={t("wallet.verifyEmail.verifying.description")}
                onBack={goToProfile}
            />
        );
    }

    return (
        <FlowStepScreen
            fixedViewport
            title={t("wallet.verifyEmail.title")}
            description={t("wallet.verifyEmail.description")}
            onBack={goToProfile}
            footer={
                <Button
                    type="button"
                    variant="primary"
                    size="large"
                    width="full"
                    disabled={
                        code.length !== CODE_LENGTH || verifyMutation.isPending
                    }
                    loading={verifyMutation.isPending}
                    onClick={() => handleVerify(code)}
                >
                    {t("wallet.verifyEmail.verify")}
                </Button>
            }
        >
            <Stack space="xs">
                <Text variant="bodySmall" weight="medium">
                    {displayEmail}
                </Text>
                <Text variant="bodySmall" color="secondary">
                    {t(
                        isRotation
                            ? "wallet.verifyEmail.statusPendingNew"
                            : "wallet.verifyEmail.statusPending"
                    )}
                </Text>
            </Stack>

            <Stack space="s">
                <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    width="auto"
                    disabled={isSending || cooldownSeconds > 0}
                    loading={isSending}
                    onClick={handleSendCurrent}
                >
                    {cooldownSeconds > 0
                        ? t("wallet.verifyEmail.resendIn", {
                              seconds: cooldownSeconds,
                          })
                        : t("wallet.verifyEmail.sendCode")}
                </Button>

                <CodeInput
                    // Remount (fresh empty inputs) when the verified
                    // target changes, so digits typed for one address never
                    // bleed into the next during a rotation.
                    key={targetEmail ?? "current"}
                    mode="alphanumeric"
                    length={CODE_LENGTH}
                    defaultValue={targetEmail ? undefined : initialCode}
                    onChange={setCode}
                    error={
                        verifyErrorKey
                            ? t(`wallet.verifyEmail.error.${verifyErrorKey}`)
                            : undefined
                    }
                    pasteLabel={t("wallet.verifyEmail.pasteCode")}
                    pasteErrorLabel={t("wallet.verifyEmail.pasteError")}
                    digitLabel={(index) =>
                        t("wallet.verifyEmail.digitLabel", { index })
                    }
                />

                {sendError && (
                    <Box
                        role="alert"
                        className={emailFormScreenStyles.inlineError}
                    >
                        <Text variant="bodySmall" color="error">
                            {t("wallet.verifyEmail.error.send")}
                        </Text>
                    </Box>
                )}
            </Stack>

            <Button
                type="button"
                variant="ghost"
                size="small"
                width="auto"
                onClick={() => {
                    resetSend();
                    setFlowState({ kind: "changeEmail" });
                }}
            >
                {t("wallet.verifyEmail.changeEmailLink")}
            </Button>
        </FlowStepScreen>
    );
}
