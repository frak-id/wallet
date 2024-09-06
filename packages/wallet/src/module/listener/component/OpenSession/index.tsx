import { RequireWebAuthN } from "@/module/common/component/RequireWebAuthN";
import { requestAndCheckStorageAccess } from "@/module/listener/component/Login";
import styles from "@/module/listener/component/Modal/index.module.css";
import { useInteractionSessionStatus } from "@/module/wallet/hook/useInteractionSessionStatus";
import { useOpenSession } from "@/module/wallet/hook/useOpenSession";
import type { OpenInteractionSessionModalStepType } from "@frak-labs/nexus-sdk/core";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useAccount } from "wagmi";

/**
 * The component for the login step of a modal
 *  todo: Autoskip instead of click when session is present
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
        isPending,
        isError,
        error,
    } = useOpenSession({
        mutations: {
            onMutate: () => {
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
            onError: (error) => {
                // If that's not an error about an existing session, directly exit
                if (error.message !== "session-exit") {
                    onError(error.message);
                }
            },
        },
    });

    return (
        <RequireWebAuthN>
            {metadata?.description && (
                <div className={prefixModalCss("text")}>
                    <p>{metadata.description}</p>
                </div>
            )}
            <div className={prefixModalCss("buttons-wrapper")}>
                <div>
                    <button
                        type={"button"}
                        className={prefixModalCss("button-primary")}
                        disabled={isPending || isFetchingStatus}
                        onClick={async () => {
                            await requestAndCheckStorageAccess();
                            openSession();
                        }}
                    >
                        {metadata?.primaryActionText ??
                            "Being rewarded with Nexus"}
                    </button>
                </div>
            </div>

            {isError && error && (
                <p className={`error ${styles.modalListener__error}`}>
                    {error.message}
                </p>
            )}
        </RequireWebAuthN>
    );
}
