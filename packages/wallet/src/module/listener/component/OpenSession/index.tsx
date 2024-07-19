import styles from "@/module/listener/component/Modal/index.module.css";
import { useInteractionSessionStatus } from "@/module/wallet/hook/useInteractionSessionStatus";
import { useOpenSession } from "@/module/wallet/hook/useOpenSession";
import type { OpenInteractionSessionModalStepType } from "@frak-labs/nexus-sdk/core";
import { prefixGlobalCss } from "@module/utils/prefixGlobalCss";
import { useAccount } from "wagmi";

/**
 * The component for the login step of a modal
 *  -> TODO: Should check if the user already got a session status, if yes, auto skip this step
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
    const { refetch: refetchSessionStatus } = useInteractionSessionStatus({
        address,
    });

    const {
        mutate: openSession,
        isPending,
        isError,
        error,
    } = useOpenSession({
        mutations: {
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
                onError(error.message);
            },
        },
    });

    return (
        <>
            {metadata?.description && (
                <div className={prefixGlobalCss("text")}>
                    <p>{metadata.description}</p>
                </div>
            )}
            <div className={prefixGlobalCss("buttons-wrapper")}>
                <div>
                    <button
                        type={"button"}
                        className={prefixGlobalCss("button-primary")}
                        disabled={isPending}
                        onClick={() => openSession()}
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
        </>
    );
}
