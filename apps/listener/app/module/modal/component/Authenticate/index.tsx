import type { SiweAuthenticateModalStepType } from "@frak-labs/core-sdk";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { RpcErrorCodes } from "@frak-labs/frame-connector";
import { useWebauthnErrorToast } from "@frak-labs/wallet-shared/authentication";
import { prefixModalCss } from "@frak-labs/wallet-shared/common";
import { useEffect, useMemo } from "react";
import { createSiweMessage, type SiweMessage } from "viem/siwe";
import { useConnection, useSignMessage } from "wagmi";
import { useListenerTranslation } from "@/ui/ListenerUiProvider";

type BuiltSiweMessage =
    | { status: "pending" }
    | { status: "ready"; message: string }
    | { status: "invalid"; reason: string };

/**
 * The component for the siwe authentication step of a modal
 */
export function SiweAuthenticateModalStep({
    params,
    onFinish,
    onError,
}: {
    params: SiweAuthenticateModalStepType["params"];
    onFinish: (result: SiweAuthenticateModalStepType["returns"]) => void;
    onError?: (reason: string, code?: number) => void;
}) {
    const { t } = useListenerTranslation();
    const { address, chainId } = useConnection();
    const siweMessage: SiweMessage | undefined = useMemo(() => {
        if (!(address && chainId)) {
            return undefined;
        }
        return {
            ...params.siwe,
            address,
            chainId,
            expirationTime: params?.siwe?.expirationTimeTimestamp
                ? new Date(params.siwe.expirationTimeTimestamp)
                : undefined,
            notBefore: params.siwe.notBeforeTimestamp
                ? new Date(params.siwe.notBeforeTimestamp)
                : undefined,
            issuedAt: new Date(),
        };
    }, [params, address, chainId]);

    // `pending` until the wallet connection resolves `address`/`chainId`.
    // Never fall back to a placeholder: signing a bogus message would produce
    // an invalid SIWE proof the backend rejects (`Invalid proof`).
    const built = useMemo<BuiltSiweMessage>(() => {
        if (!siweMessage) return { status: "pending" };
        try {
            return {
                status: "ready",
                message: createSiweMessage(siweMessage),
            };
        } catch (error) {
            // viem validates every EIP-4361 field here, during render, and
            // the listener has no error boundary — translate the throw into
            // an RPC rejection instead of a modal nobody can sign.
            return {
                status: "invalid",
                reason:
                    error instanceof Error
                        ? error.message
                        : "Invalid SIWE parameters",
            };
        }
    }, [siweMessage]);

    const message = built.status === "ready" ? built.message : undefined;

    useEffect(() => {
        if (built.status !== "invalid") return;
        onError?.(built.reason, RpcErrorCodes.serverError);
    }, [built, onError]);

    const {
        mutate: signMessage,
        isPending,
        error,
    } = useSignMessage({
        mutation: {
            // Link success and error hooks
            onSuccess: (signature) =>
                onFinish({
                    signature,
                    message: message as string,
                }),
        },
    });

    // Surface signing errors in the top modal toast (same UX as the wallet app).
    useWebauthnErrorToast(error, {
        operation: "sign",
        onRetry: () => message && signMessage({ message }),
    });

    // Block signing until the SIWE message is built (connection ready).
    const isReady = message !== undefined;

    return (
        <>
            {siweMessage?.domain && (
                <Card variant="secondary" radius="m" padding="default">
                    <Text variant="bodySmall">
                        {t("sdk.modal.siweAuthenticate.connectingTo", {
                            domain: siweMessage.domain,
                        })}
                    </Text>
                </Card>
            )}

            <Stack space="m" className={prefixModalCss("buttons-wrapper")}>
                {/* Stay visually primary while pending (spinner + click guard)
                 * — the DS disabled state is too low-contrast on the light
                 * modal surface. */}
                <Button
                    variant="primary"
                    size="large"
                    icon={
                        isPending || !isReady ? <Spinner size="s" /> : undefined
                    }
                    aria-busy={isPending || !isReady}
                    className={prefixModalCss("button-primary")}
                    onClick={() => {
                        if (isPending || !message) return;
                        signMessage({ message });
                    }}
                >
                    {t("sdk.modal.siweAuthenticate.primaryAction")}
                </Button>
            </Stack>
        </>
    );
}
