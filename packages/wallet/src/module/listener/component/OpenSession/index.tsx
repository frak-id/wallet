import { Panel } from "@/module/common/component/Panel";
import { HelpModal } from "@/module/listener/component/Modal";
import styles from "@/module/listener/component/Modal/index.module.css";
import { useInteractionSessionStatus } from "@/module/wallet/hook/useInteractionSessionStatus";
import { useOpenSession } from "@/module/wallet/hook/useOpenSession";
import type { OpenInteractionSessionModalStepType } from "@frak-labs/nexus-sdk/core";
import { AuthFingerprint } from "@module/component/AuthFingerprint";
import { useAccount } from "wagmi";

/**
 * The component for the login step of a modal
 *  -> TODO: Should check if the user already got a session status, if yes, auto skip this step
 * @param onClose
 * @constructor
 */
export function OpenSessionModalStep({
    onFinish,
    onError,
}: {
    params: OpenInteractionSessionModalStepType["params"];
    onFinish: (args: OpenInteractionSessionModalStepType["returns"]) => void;
    onError: (reason?: string) => void;
}) {
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
            <Panel size={"normal"}>
                <p>
                    Setting up a rewarding session. This will allow you to
                    seamlessly discount or perks based on your interaction with
                    the application.
                </p>
            </Panel>
            <HelpModal />
            <AuthFingerprint
                className={styles.modalListener__action}
                disabled={isPending}
                action={() => {
                    openSession();
                }}
            >
                Open session
            </AuthFingerprint>

            {isError && error && (
                <p className={`error ${styles.modalListener__error}`}>
                    {error.message}
                </p>
            )}
        </>
    );
}
