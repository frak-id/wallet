import { IconInfo } from "@frak-labs/ui/component/IconInfo";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { Switch } from "@frak-labs/ui/component/Switch";
import { Tooltip } from "@frak-labs/ui/component/Tooltip";
import type { InteractionSession } from "@frak-labs/wallet-shared/types/Session";
import { useCloseSession } from "@frak-labs/wallet-shared/wallet/hook/useCloseSession";
import { useInteractionSessionStatus } from "@frak-labs/wallet-shared/wallet/hook/useInteractionSessionStatus";
import { useOpenSession } from "@frak-labs/wallet-shared/wallet/hook/useOpenSession";
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
