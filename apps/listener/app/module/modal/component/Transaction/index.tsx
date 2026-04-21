import type { SendTransactionModalStepType } from "@frak-labs/core-sdk";
import { DEEP_LINK_SCHEME } from "@frak-labs/core-sdk";
import {
    encodeWalletMulticall,
    type Flow,
    HandleErrors,
    sessionStore,
    startFlow,
    trackEvent,
    ua,
    useMountedTimeout,
} from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useSendTransaction } from "wagmi";
import { useStore } from "zustand";
import { ButtonAuth } from "@/module/component/ButtonAuth";
import { useDeepLinkFallback } from "@/module/hooks/useDeepLinkFallback";
import { AccordionTransactions } from "@/module/modal/component/Transaction/AccordionTransactions";
import { useListenerTranslation } from "@/module/providers/ListenerUiProvider";
import styles from "./index.module.css";

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
        const flow = startFlow("listener_transaction");
        flowRef.current = flow;
        flow.track("listener_tx_viewed", {
            tx_count: txs.length,
            is_mobile_pairing: isMobilePairing,
        });
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
                const flow = flowRef.current;
                flow?.track("listener_tx_succeeded", {
                    tx_count: txs.length,
                    hash,
                });
                flow?.end("succeeded");
                onFinish({ hash });
            },
            onError: (err) => {
                const flow = flowRef.current;
                flow?.track("listener_tx_failed", {
                    tx_count: txs.length,
                    reason: err?.message ?? "unknown",
                });
                flow?.end("failed", { error_type: err?.name });
            },
        },
    });

    if (!(params && toSendTx)) {
        return null;
    }

    const onSubmit = () => {
        flowRef.current?.track("listener_tx_submitted", {
            tx_count: txs.length,
        });
    };

    if (isMobilePairing) {
        return (
            <MobileTransactionStep
                txs={txs}
                toSendTx={toSendTx}
                sendTransaction={sendTransaction}
                onSubmit={onSubmit}
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
            onSubmit={onSubmit}
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
    onSubmit: () => void;
    isPending: boolean;
    isError: boolean;
    error: Error | null;
};

function DesktopTransactionStep({
    txs,
    toSendTx,
    sendTransaction,
    onSubmit,
    isPending,
    isError,
    error,
}: TransactionStepProps) {
    const { t } = useListenerTranslation();

    return (
        <>
            <AccordionTransactions txs={txs} />

            <ButtonAuth
                size={"small"}
                width={"full"}
                disabled={isPending}
                onClick={() => {
                    onSubmit();
                    sendTransaction(toSendTx);
                }}
            >
                {t("sdk.modal.sendTransaction.primaryAction", {
                    count: txs.length,
                })}
            </ButtonAuth>

            {isError && error && <HandleErrors error={error} />}
        </>
    );
}

function MobileTransactionStep({
    txs,
    toSendTx,
    sendTransaction,
    onSubmit,
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
        (retry: boolean) => {
            flowRef.current?.track(
                "listener_tx_mobile_deeplink_clicked",
                { retry }
            );
            emitRedirectWithFallback(mobileWalletDeepLink, () => {
                flowRef.current?.track("listener_tx_mobile_app_not_found", {});
                setAppNotFound(true);
            });
        },
        [emitRedirectWithFallback, flowRef]
    );

    const triggerTransaction = useCallback(() => {
        setStatus("waiting");
        onSubmit();
        sendTransaction(toSendTx);

        // Trigger deep link immediately — must stay synchronous in click
        // handler to preserve user gesture (Chrome Android blocks async
        // deep links with a "Continue to app?" confirmation bar).
        // The WS signature request is already queued by sendTransaction().
        emitDeepLink(false);

        startTimeout(() => {
            if (!isPendingRef.current) return;
            flowRef.current?.track("listener_tx_mobile_timeout", {});
            setStatus("timeout");
        }, 30_000);
    }, [
        sendTransaction,
        toSendTx,
        emitDeepLink,
        startTimeout,
        onSubmit,
        flowRef,
    ]);

    useEffect(() => {
        if (!isError && !isPending && status === "waiting") {
            clearTxTimeout();
        }
    }, [isPending, isError, status, clearTxTimeout]);



    if (appNotFound) {
        return (
            <div className={styles.mobileTx__appNotFound}>
                <p className={styles.mobileTx__appNotFoundText}>
                    {t("mobile-tx.appNotFound")}
                </p>
                <p className={styles.mobileTx__appNotFoundHint}>
                    {t("mobile-tx.appNotFoundHint")}
                </p>
                <button
                    type="button"
                    onClick={() => setAppNotFound(false)}
                    className={styles.mobileTx__retryButton}
                >
                    {t("mobile-tx.retry")}
                </button>
            </div>
        );
    }

    return (
        <>
            <AccordionTransactions txs={txs} />

            <ButtonAuth
                size={"small"}
                width={"full"}
                disabled={isPending}
                onClick={triggerTransaction}
            >
                {t("mobile-tx.sendTransaction")}
            </ButtonAuth>

            {/* Waiting state - show after user triggered tx + deep link */}
            {isPending && status === "waiting" && (
                <div className={styles.mobileTx__statusContainer}>
                    <p className={styles.mobileTx__statusText}>
                        {t("mobile-tx.waiting")}
                    </p>
                    <button
                        type="button"
                        onClick={() => emitDeepLink(true)}
                        className={styles.mobileTx__reopenLink}
                    >
                        {t("mobile-tx.reopenWallet")}
                    </button>
                </div>
            )}

            {/* Timeout state */}
            {status === "timeout" && (
                <div className={styles.mobileTx__statusContainer}>
                    <p className={styles.mobileTx__timeoutText}>
                        {t("mobile-tx.timeout")}
                    </p>
                    <button
                        type="button"
                        onClick={triggerTransaction}
                        className={styles.mobileTx__retryButton}
                    >
                        {t("mobile-tx.retry")}
                    </button>
                </div>
            )}

            {isError && error && <HandleErrors error={error} />}
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
