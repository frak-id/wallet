import { Panel } from "@/module/common/component/Panel";
import { Switch } from "@/module/common/component/Switch";
import { useCloseSession } from "@/module/wallet/hook/useCloseSession";
import { useInteractionSessionStatus } from "@/module/wallet/hook/useInteractionSessionStatus";
import { useOpenSession } from "@/module/wallet/hook/useOpenSession";
import type { InteractionSession } from "@/types/Session";
import { IconInfo } from "@module/component/IconInfo";
import { Spinner } from "@module/component/Spinner";
import { Tooltip } from "@module/component/Tooltip";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import styles from "./index.module.css";

export function ToggleSession() {
    const { address } = useAccount();

    const { data: sessionStatus, isPending: sessionStatusIsPending } =
        useInteractionSessionStatus({
            address,
        });

    const { mutate: openSession, isPending: isOpeningSession } =
        useOpenSession();

    const { mutate: closeSession, isPending: isClosingSession } =
        useCloseSession();

    if (sessionStatusIsPending) {
        return null;
    }

    return (
        <>
            <Panel variant={"invisible"} size={"none"}>
                <SessionClosed isClosed={!sessionStatus} />
                <div className={styles.toggleSession}>
                    <Switch
                        checked={!!sessionStatus}
                        onCheckedChange={(checked) => {
                            // If checked, open the session
                            if (checked) {
                                openSession();
                                return;
                            }

                            // Otherwise, close the session
                            closeSession();
                        }}
                    />{" "}
                    {sessionStatus
                        ? "Your session is open. You can be rewarded"
                        : "Open a session to get reward"}{" "}
                    <SessionTooltip sessionStatus={sessionStatus} />
                    {(isOpeningSession || isClosingSession) && <Spinner />}
                </div>
            </Panel>
        </>
    );
}

function SessionClosed({ isClosed }: { isClosed: boolean }) {
    const [closed, setClosed] = useState(false);

    useEffect(() => {
        setClosed(isClosed);
    }, [isClosed]);

    return (
        closed && (
            <div className={styles.sessionClosed}>
                <p>
                    <span className={styles.sessionClosed__warning}>
                        &#9888;
                    </span>{" "}
                    Your session is closed. You can’t be rewarded.
                </p>
                <button
                    type={"button"}
                    className={styles.sessionClosed__close}
                    onClick={() => setClosed(false)}
                >
                    <X size={10} />
                </button>
            </div>
        )
    );
}

function SessionTooltip({
    sessionStatus,
}: {
    sessionStatus?: InteractionSession | null;
}) {
    return (
        <Tooltip
            content={
                sessionStatus ? (
                    <>
                        You got an active session since{" "}
                        {new Date(
                            sessionStatus?.sessionStart
                        )?.toLocaleDateString()}{" "}
                        and until{" "}
                        {new Date(
                            sessionStatus?.sessionEnd
                        )?.toLocaleDateString()}
                    </>
                ) : (
                    "The session creation will permit us to send interaction data on chain for your wallet"
                )
            }
        >
            <IconInfo />
        </Tooltip>
    );
}
