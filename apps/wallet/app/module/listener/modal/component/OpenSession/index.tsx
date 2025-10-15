import type { OpenInteractionSessionModalStepType } from "@frak-labs/core-sdk";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { prefixModalCss } from "@frak-labs/ui/utils/prefixModalCss";
import { useEffect } from "react";
import { HandleErrors } from "@/module/listener/component/HandleErrors";
import styles from "@/module/listener/modal/component/Modal/index.module.css";
import { useListenerTranslation } from "@/module/listener/providers/ListenerUiProvider";
import { useInteractionSessionStatus } from "@/module/wallet/hook/useInteractionSessionStatus";
import { useOpenSession } from "@/module/wallet/hook/useOpenSession";

/**
 * The component for the login step of a modal
 * @param onClose
 * @constructor
 */
export function OpenSessionModalStep({
    onFinish,
    onError,
}: {
    onFinish: (args: OpenInteractionSessionModalStepType["returns"]) => void;
    onError: (reason?: string) => void;
}) {
    const { t } = useListenerTranslation();
    const {
        data: currentSession,
        isPending: isFetchingStatus,
        refetch: refetchSessionStatus,
    } = useInteractionSessionStatus({
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
                        }}
                    >
                        {isPending && <Spinner />}
                        {t("sdk.modal.openSession.primaryAction")}
                    </button>
                </div>
            </div>

            {isError && error && <HandleErrors error={error} />}
        </>
    );
}
