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
import { Back } from "@/module/common/component/Back";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";
import {
    EmailFormScreen,
    emailFormScreenStyles,
} from "@/module/common/component/EmailFormScreen";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { useSendEmailVerification } from "@/module/email-verification/hook/useSendEmailVerification";
import { useVerifyEmailCode } from "@/module/email-verification/hook/useVerifyEmailCode";
import { ConflictStep } from "@/module/settings/component/AddEmail/ConflictStep";
import { MergeFlow } from "@/module/walletMerge/component/MergeFlow";

const CODE_LENGTH = 6;

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
    if (status && status !== "verified") return status;
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
            const result = await verifyMutation.mutateAsync(value);
            if (result.status === "verified") {
                setFlowState({ kind: "success", email: result.email });
            }
        },
        [verifyMutation]
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
        await sendCode(targetEmail);
    }, [sendCode, targetEmail, verifyMutation]);

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
        const startMerge = () => {
            if (!flowState.targetWallet || !session?.authenticatorId) return;
            setFlowState({
                kind: "merging",
                email: flowState.email,
                currentAuthenticatorId: session.authenticatorId,
                targetAuthenticatorIds: flowState.targetAuthenticatorIds,
                targetWallet: flowState.targetWallet,
            });
        };
        return (
            <ConflictStep
                targetAuthenticatorIds={flowState.targetAuthenticatorIds}
                targetWallet={flowState.targetWallet}
                onMerge={startMerge}
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
                onEmailChange={() => resetSend()}
            >
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

    const displayEmail =
        targetEmail ?? emailStatus?.pendingEmail ?? emailStatus?.email ?? "";

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
            />
        );
    }

    return (
        <PageLayout
            fixedViewport
            back={<Back onClick={goToProfile} />}
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
            <Stack space="l">
                <Stack space="s">
                    <Title size="page">{t("wallet.verifyEmail.title")}</Title>
                    <Text variant="body" color="secondary">
                        {t("wallet.verifyEmail.description")}
                    </Text>
                </Stack>

                <Stack space="xs">
                    <Text variant="bodySmall" weight="medium">
                        {displayEmail}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {t("wallet.verifyEmail.statusPending")}
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
                        mode="numeric"
                        length={CODE_LENGTH}
                        onChange={setCode}
                        error={
                            verifyErrorKey
                                ? t(
                                      `wallet.verifyEmail.error.${verifyErrorKey}`
                                  )
                                : undefined
                        }
                        pasteLabel={t("wallet.verifyEmail.pasteCode")}
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
            </Stack>
        </PageLayout>
    );
}
