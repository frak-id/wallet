import type { SendTransactionModalStepType } from "@frak-labs/core-sdk";
import { DEEP_LINK_SCHEME } from "@frak-labs/core-sdk";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useWebauthnErrorToast } from "@frak-labs/wallet-shared/authentication";
import {
    type Flow,
    prefixModalCss,
    startFlow,
    ua,
    useMountedTimeout,
    webauthnErrorContext,
} from "@frak-labs/wallet-shared/common";
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import { encodeWalletMulticall } from "@frak-labs/wallet-shared/wallet/utils/multicall";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useSendTransaction } from "wagmi";
import { useStore } from "zustand";
import { useDeepLinkFallback } from "@/module/hooks/useDeepLinkFallback";
import { AccordionTransactions } from "@/module/modal/component/Transaction/AccordionTransactions";
import { useListenerTranslation } from "@/ui/ListenerUiProvider";

const mobileWalletDeepLink = `${DEEP_LINK_SCHEME}wallet`;

/**
 * Transaction step modal — routes to desktop (direct WebAuthn) or mobile (distant-webauthn via deep link) flow.
 *
 * Analytics: wraps the whole interaction in a `listener_transaction` flow so
 * the `flow_id` stitches `viewed → submitted → succeeded/failed` in OpenPanel.
 */
export function TransactionModalStep({
    params,
    onFinish,
}: {
    params: SendTransactionModalStepType["params"];
    onFinish: (result: SendTransactionModalStepType["returns"]) => void;
}) {
    const { txs, toSendTx } = useMappedTx({ tx: params.tx });

    const sessionType = useStore(sessionStore, (s) => s.session?.type);
    const isMobilePairing = ua.isMobile && sessionType === "distant-webauthn";

    // Scoped analytics flow for the transaction interaction.
    // Abandonment: flow.end("abandoned") on unmount if not already terminated.
    const flowRef = useRef<Flow | null>(null);
    useEffect(() => {
        const flow = startFlow("listener_tx", {
            tx_count: txs.length,
            is_mobile_pairing: isMobilePairing,
        });
        flowRef.current = flow;
        return () => {
            if (!flow.ended) flow.end("abandoned");
        };
        // Flow is intentionally tied to component lifetime — txs.length /
        // isMobilePairing only affect the initial snapshot.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const {
        mutate: sendTransaction,
        isPending,
        isError,
        error,
    } = useSendTransaction({
        mutation: {
            onSuccess: (hash) => {
                flowRef.current?.end("succeeded", {
                    tx_count: txs.length,
                    hash,
                });
                onFinish({ hash });
            },
            onError: (err) => {
                flowRef.current?.end("failed", {
                    tx_count: txs.length,
                    operation: "sign",
                    error_type: err?.name,
                    error_message: err?.message ?? "unknown",
                    ...webauthnErrorContext(err),
                });
            },
        },
    });

    if (!(params && toSendTx)) {
        return null;
    }

    if (isMobilePairing) {
        return (
            <MobileTransactionStep
                txs={txs}
                toSendTx={toSendTx}
                sendTransaction={sendTransaction}
                flowRef={flowRef}
                isPending={isPending}
                isError={isError}
                error={error}
            />
        );
    }

    return (
        <DesktopTransactionStep
            txs={txs}
            toSendTx={toSendTx}
            sendTransaction={sendTransaction}
            isPending={isPending}
            isError={isError}
            error={error}
        />
    );
}

type TransactionStepProps = {
    txs: ReturnType<typeof useMappedTx>["txs"];
    toSendTx: NonNullable<ReturnType<typeof useMappedTx>["toSendTx"]>;
    sendTransaction: ReturnType<typeof useSendTransaction>["sendTransaction"];
    isPending: boolean;
    isError: boolean;
    error: Error | null;
};

function DesktopTransactionStep({
    txs,
    toSendTx,
    sendTransaction,
    isPending,
    error,
}: TransactionStepProps) {
    const { t } = useListenerTranslation();

    // Surface signing errors in the top modal toast (same UX as the wallet app).
    useWebauthnErrorToast(error, {
        operation: "sign",
        onRetry: () => sendTransaction(toSendTx),
    });

    return (
        <>
            <AccordionTransactions txs={txs} />

            <Stack space="m" className={prefixModalCss("buttons-wrapper")}>
                <Button
                    variant="primary"
                    size="large"
                    icon={isPending ? <Spinner size="s" /> : undefined}
                    aria-busy={isPending}
                    className={prefixModalCss("button-primary")}
                    onClick={() => {
                        if (isPending) return;
                        sendTransaction(toSendTx);
                    }}
                >
                    {t("sdk.modal.sendTransaction.primaryAction", {
                        count: txs.length,
                    })}
                </Button>
            </Stack>
        </>
    );
}

function MobileTransactionStep({
    txs,
    toSendTx,
    sendTransaction,
    flowRef,
    isPending,
    isError,
    error,
}: TransactionStepProps & {
    flowRef: React.MutableRefObject<Flow | null>;
}) {
    const { t } = useListenerTranslation();
    const [status, setStatus] = useState<"idle" | "waiting" | "timeout">(
        "idle"
    );
    const [appNotFound, setAppNotFound] = useState(false);
    const { startTimeout, clearTimeout: clearTxTimeout } = useMountedTimeout();
    const { emitRedirectWithFallback } = useDeepLinkFallback();
    const isPendingRef = useRef(isPending);
    isPendingRef.current = isPending;

    const emitDeepLink = useCallback(
        (_retry: boolean) => {
            emitRedirectWithFallback(mobileWalletDeepLink, () => {
                flowRef.current?.track("listener_tx_mobile_app_not_found", {});
                setAppNotFound(true);
            });
        },
        [emitRedirectWithFallback, flowRef]
    );

    const triggerTransaction = useCallback(() => {
        setStatus("waiting");
        sendTransaction(toSendTx);

        // Trigger deep link immediately — must stay synchronous in click
        // handler to preserve user gesture (Chrome Android blocks async
        // deep links with a "Continue to app?" confirmation bar).
        // The WS signature request is already queued by sendTransaction().
        emitDeepLink(false);

        startTimeout(() => {
            if (!isPendingRef.current) return;
            setStatus("timeout");
        }, 30_000);
    }, [sendTransaction, toSendTx, emitDeepLink, startTimeout]);

    useEffect(() => {
        if (!isError && !isPending && status === "waiting") {
            clearTxTimeout();
        }
    }, [isPending, isError, status, clearTxTimeout]);

    // Surface signing errors in the top modal toast (same UX as the wallet app).
    useWebauthnErrorToast(error, {
        operation: "sign",
        onRetry: triggerTransaction,
    });

    if (appNotFound) {
        return (
            <Card variant="secondary" radius="m" padding="default">
                <Stack space="m" align="center">
                    <Stack space="xs" align="center">
                        <Text variant="body" weight="semiBold" align="center">
                            {t("mobile-tx.appNotFound")}
                        </Text>
                        <Text
                            variant="bodySmall"
                            color="secondary"
                            align="center"
                        >
                            {t("mobile-tx.appNotFoundHint")}
                        </Text>
                    </Stack>
                    <Button
                        variant="secondary"
                        size="large"
                        onClick={() => setAppNotFound(false)}
                    >
                        {t("mobile-tx.retry")}
                    </Button>
                </Stack>
            </Card>
        );
    }

    return (
        <>
            <AccordionTransactions txs={txs} />

            <Stack space="m" className={prefixModalCss("buttons-wrapper")}>
                <Button
                    variant="primary"
                    size="large"
                    icon={isPending ? <Spinner size="s" /> : undefined}
                    aria-busy={isPending}
                    className={prefixModalCss("button-primary")}
                    onClick={() => {
                        if (isPending) return;
                        triggerTransaction();
                    }}
                >
                    {t("mobile-tx.sendTransaction")}
                </Button>
            </Stack>

            {/* Waiting state - show after user triggered tx + deep link */}
            {isPending && status === "waiting" && (
                <Stack space="xs" align="center">
                    <Text variant="bodySmall" align="center">
                        {t("mobile-tx.waiting")}
                    </Text>
                    <Button
                        variant="ghost"
                        size="small"
                        onClick={() => emitDeepLink(true)}
                    >
                        {t("mobile-tx.reopenWallet")}
                    </Button>
                </Stack>
            )}

            {/* Timeout state */}
            {status === "timeout" && (
                <Stack space="m" align="center">
                    <Text variant="bodySmall" color="error" align="center">
                        {t("mobile-tx.timeout")}
                    </Text>
                    <Button
                        variant="secondary"
                        size="large"
                        onClick={triggerTransaction}
                    >
                        {t("mobile-tx.retry")}
                    </Button>
                </Stack>
            )}
        </>
    );
}

function useMappedTx({
    tx,
}: {
    tx: SendTransactionModalStepType["params"]["tx"];
}) {
    const { address } = useConnection();

    return useMemo(() => {
        if (!tx || !address) {
            return {
                txs: [],
                toSendTx: undefined,
            };
        }

        // Case of a single tx
        if (!Array.isArray(tx)) {
            return {
                txs: [tx],
                toSendTx: { ...tx, value: tx.value ? BigInt(tx.value) : 0n },
            };
        }

        // Otherwise, prepare a batch call
        return {
            txs: tx,
            toSendTx: {
                to: address,
                value: 0n,
                data: encodeWalletMulticall(
                    tx.map((tx) => ({
                        to: tx.to,
                        data: tx.data ?? "0x",
                        value: tx.value ? BigInt(tx.value) : undefined,
                    }))
                ),
            },
        };
    }, [address, tx]);
}
