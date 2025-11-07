import { useInteractionSessionStatus } from "@frak-labs/wallet-shared";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { Panel } from "@/module/common/component/Panel";
import { ToggleSession } from "@/module/common/component/ToggleSession";
import { Warning } from "@/module/common/component/Warning";
import styles from "./index.module.css";

export function OpenSession() {
    const { address } = useAccount();

    const { data: sessionStatus, isPending: sessionStatusIsPending } =
        useInteractionSessionStatus({
            address,
        });

    if (sessionStatusIsPending || sessionStatus) {
        return null;
    }

    return (
        <Panel variant={"invisible"} size={"none"}>
            <SessionClosed isClosed={!sessionStatus} />
            <ToggleSession />
        </Panel>
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
            <Warning text={t("wallet.session.closed")}>
                <button
                    type={"button"}
                    className={styles.sessionClosed__button}
                    onClick={() => setClosed(false)}
                >
                    <X size={16} />
                </button>
            </Warning>
        )
    );
}
