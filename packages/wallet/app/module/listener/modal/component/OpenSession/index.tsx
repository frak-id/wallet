import styles from "@/module/listener/modal/component/Modal/index.module.css";
import { useInteractionSessionStatus } from "@/module/wallet/hook/useInteractionSessionStatus";
import { useOpenSession } from "@/module/wallet/hook/useOpenSession";
import type { OpenInteractionSessionModalStepType } from "@frak-labs/core-sdk";
import { Spinner } from "@module/component/Spinner";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { trackEvent } from "@module/utils/trackEvent";
import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useModalTranslation } from "../../../hooks/useModalTranslation";

/**
 * The component for the login step of a modal
 * @param onClose
 * @constructor
 */
export function OpenSessionModalStep({
    params,
    onFinish,
    onError,
}: {
    params: OpenInteractionSessionModalStepType["params"];
    onFinish: (args: OpenInteractionSessionModalStepType["returns"]) => void;
    onError: (reason?: string) => void;
}) {
    const { t } = useModalTranslation();
    const { metadata } = params;
    const { address } = useAccount();
    const {
        data: currentSession,
        isPending: isFetchingStatus,
        refetch: refetchSessionStatus,
    } = useInteractionSessionStatus({
        address,
        query: {
            refetchOnMount: true,
            refetchOnWindowFocus: true,
            staleTime: 0,
        },
    });

    const {
        mutate: openSession,
        isIdle,
        isPending,
        isError,
        error,
    } = useOpenSession({
        mutations: {
            onMutate: async () => {
                // If we already got a session, directly exit
                if (currentSession) {
                    onFinish({
                        startTimestamp: currentSession.sessionStart,
                        endTimestamp: currentSession.sessionEnd,
                    });
                    throw new Error("session-exit");
                }
            },
            onSuccess: async () => {
                // Fetch the session status
                const status = await refetchSessionStatus();
                if (!status.data) {
                    onError("Failed to open the session status");
                    return;
                }

                // Finish the step
                onFinish({
                    startTimestamp: status.data.sessionStart,
                    endTimestamp: status.data.sessionEnd,
                });
            },
        },
    });

    // Small effect to auto skip this step if a session is already set
    useEffect(() => {
        // If the open session isn't idle, it mean that we are doing some shenanigans there
        if (!isIdle) return;

        // If we already got a session, directly exit
        if (currentSession) {
            onFinish({
                startTimestamp: currentSession.sessionStart,
                endTimestamp: currentSession.sessionEnd,
            });
        }
    }, [currentSession, onFinish, isIdle]);

    return (
        <>
            <div
                className={`${styles.modalListener__buttonsWrapper} ${prefixModalCss("buttons-wrapper")}`}
            >
                <div>
                    <button
                        type={"button"}
                        className={`${styles.modalListener__buttonPrimary} ${prefixModalCss("button-primary")}`}
                        disabled={isPending || isFetchingStatus}
                        onClick={() => {
                            openSession();
                            trackEvent("cta-open-session");
                        }}
                    >
                        {isPending && <Spinner />}
                        {metadata?.primaryActionText ??
                            t("sdk.modal.openSession.default.primaryAction")}
                    </button>
                </div>
            </div>

            {isError && error && (
                <p className={`error ${styles.modalListener__error}`}>
                    {error.message}
                </p>
            )}
        </>
    );
}
