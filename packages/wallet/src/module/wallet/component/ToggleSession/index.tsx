import { Panel } from "@/module/common/component/Panel";
import { useCloseSession } from "@/module/wallet/hook/useCloseSession";
import { useInteractionSessionStatus } from "@/module/wallet/hook/useInteractionSessionStatus";
import { useOpenSession } from "@/module/wallet/hook/useOpenSession";
import type { InteractionSession } from "@/types/Session";
import { IconInfo } from "@module/component/IconInfo";
import { Spinner } from "@module/component/Spinner";
import { Switch } from "@module/component/Switch";
import { Tooltip } from "@module/component/Tooltip";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import styles from "./index.module.css";

export function ToggleSession() {
    const { t } = useTranslation();
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
                        ? t("wallet.session.open")
                        : t("wallet.session.openSession")}{" "}
                    <SessionTooltip sessionStatus={sessionStatus} />
                    {(isOpeningSession || isClosingSession) && <Spinner />}
                </div>
            </Panel>
        </>
    );
}

function SessionClosed({ isClosed }: { isClosed: boolean }) {
    const { t } = useTranslation();
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
                    {t("wallet.session.closed")}
                </p>
                <button
                    type={"button"}
                    className={styles.sessionClosed__close}
                    onClick={() => setClosed(false)}
                >
                    <X size={16} />
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
    const { t } = useTranslation();
    return (
        <Tooltip
            content={
                sessionStatus
                    ? t("wallet.session.tooltip.active", {
                          sessionStart: new Date(
                              sessionStatus?.sessionStart
                          )?.toLocaleDateString(),
                          sessionEnd: new Date(
                              sessionStatus?.sessionEnd
                          )?.toLocaleDateString(),
                      })
                    : t("wallet.session.tooltip.inactive")
            }
        >
            <IconInfo />
        </Tooltip>
    );
}
