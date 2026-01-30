import type { SendTransactionModalStepType } from "@frak-labs/core-sdk";
import { DEEP_LINK_SCHEME } from "@frak-labs/core-sdk";
import { ButtonAuth } from "@frak-labs/ui/component/ButtonAuth";
import {
    emitLifecycleEvent,
    encodeWalletMulticall,
    HandleErrors,
    sessionStore,
    ua,
} from "@frak-labs/wallet-shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useSendTransaction } from "wagmi";
import { useStore } from "zustand";
import { AccordionTransactions } from "@/module/modal/component/Transaction/AccordionTransactions";
import { useListenerTranslation } from "@/module/providers/ListenerUiProvider";

/**
 * The component for the transaction step of a modal
 * @param onClose
 * @constructor
 */
export function TransactionModalStep({
    params,
    onFinish,
}: {
    params: SendTransactionModalStepType["params"];
    onFinish: (result: SendTransactionModalStepType["returns"]) => void;
}) {
    const { t } = useListenerTranslation();
    const { sendTransaction, isPending, isError, error } = useSendTransaction({
        mutation: {
            // Link success and error hooks
            onSuccess: (hash) => {
                onFinish({ hash });
            },
        },
    });

    const { txs, toSendTx } = useMappedTx({ tx: params.tx });

    // Mobile distant-webauthn flow state
    const sessionType = useStore(sessionStore, (s) => s.session?.type);
    const isMobilePairing = ua.isMobile && sessionType === "distant-webauthn";
    const [hasTriggered, setHasTriggered] = useState(false);
    const [status, setStatus] = useState<
        "idle" | "pending" | "waiting" | "timeout"
    >("idle");
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Handle timeout for mobile flow
    useEffect(() => {
        if (!isMobilePairing || !isPending || !hasTriggered) return;

        setStatus("pending");

        timeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            // Check if already succeeded (race condition)
            if (!isPending) return;
            setStatus("timeout");
        }, 30_000);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [isMobilePairing, isPending, hasTriggered]);

    // Clear timeout on success
    useEffect(() => {
        if (!isError && !isPending && hasTriggered && timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, [isPending, isError, hasTriggered]);

    if (!(params && toSendTx)) {
        return null;
    }

    const deepLinkHref = `${DEEP_LINK_SCHEME}wallet`;

    // Desktop flow (unchanged)
    if (!isMobilePairing) {
        return (
            <>
                <AccordionTransactions txs={txs} />

                <ButtonAuth
                    size={"small"}
                    width={"full"}
                    disabled={isPending}
                    onClick={() => {
                        if (!toSendTx) return;
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

    // Mobile distant-webauthn flow
    return (
        <>
            <AccordionTransactions txs={txs} />

            <ButtonAuth
                size={"small"}
                width={"full"}
                disabled={isPending || hasTriggered}
                onClick={() => {
                    if (!toSendTx) return;
                    setHasTriggered(true);
                    setStatus("waiting");
                    sendTransaction(toSendTx);
                    // Open wallet app via parent page (iframe can't navigate custom schemes on iOS)
                    emitLifecycleEvent({
                        iframeLifecycle: "redirect",
                        data: { baseRedirectUrl: deepLinkHref },
                    });
                }}
            >
                {t("mobile-tx.sendTransaction")}
            </ButtonAuth>

            {/* Waiting state - show after user triggered tx + deep link */}
            {hasTriggered && isPending && status !== "timeout" && (
                <div style={{ marginTop: "1rem", textAlign: "center" }}>
                    <p style={{ marginBottom: "0.5rem", fontSize: "0.875rem" }}>
                        {t("mobile-tx.waiting")}
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            emitLifecycleEvent({
                                iframeLifecycle: "redirect",
                                data: {
                                    baseRedirectUrl: deepLinkHref,
                                },
                            });
                        }}
                        style={{
                            color: "#007AFF",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                        }}
                    >
                        {t("mobile-tx.reopenWallet")}
                    </button>
                </div>
            )}

            {/* Timeout state */}
            {status === "timeout" && (
                <div style={{ marginTop: "1rem", textAlign: "center" }}>
                    <p
                        style={{
                            marginBottom: "1rem",
                            fontSize: "0.875rem",
                            color: "#d32f2f",
                        }}
                    >
                        {t("mobile-tx.timeout")}
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setStatus("waiting");
                            emitLifecycleEvent({
                                iframeLifecycle: "redirect",
                                data: {
                                    baseRedirectUrl: deepLinkHref,
                                },
                            });
                        }}
                        style={{
                            display: "inline-block",
                            padding: "0.75rem 1.5rem",
                            backgroundColor: "#007AFF",
                            color: "white",
                            borderRadius: "0.5rem",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                        }}
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
    const { address } = useAccount();

    return useMemo(() => {
        if (!(tx || !address)) {
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
