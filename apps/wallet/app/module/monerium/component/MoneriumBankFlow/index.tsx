import { Box } from "@frak-labs/design-system/components/Box";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { openExternalUrl } from "@frak-labs/wallet-shared";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMoneriumBeneficiarySync } from "@/module/monerium/hooks/useMoneriumBeneficiarySync";
import { useMoneriumStatus } from "@/module/monerium/hooks/useMoneriumStatus";
import {
    moneriumFlowStore,
    selectScreen,
} from "@/module/monerium/store/moneriumFlowStore";
import { moneriumStore } from "@/module/monerium/store/moneriumStore";
import { deriveSetupScreen } from "@/module/monerium/utils/deriveSetupScreen";
import { MONERIUM_PORTAL_URL } from "@/module/monerium/utils/moneriumConfig";
import { MoneriumConnectScreen } from "./MoneriumConnectScreen";
import { MoneriumLinkScreen } from "./MoneriumLinkScreen";
import { MoneriumPendingScreen } from "./MoneriumPendingScreen";
import { MoneriumScreen } from "./MoneriumScreen";
import { MoneriumTransferAmountScreen } from "./MoneriumTransferAmountScreen";
import { MoneriumTransferIbanScreen } from "./MoneriumTransferIbanScreen";
import { MoneriumTransferRecapScreen } from "./MoneriumTransferRecapScreen";

type MoneriumBankFlowProps = {
    onClose: () => void;
};

/**
 * Root of the Monerium bank-transfer flow.
 *
 * The setup screen is derived from the single status query on every render;
 * once setup is done, the transfer screens are navigated through `moneriumFlowStore`.
 */
export function MoneriumBankFlow({ onClose }: MoneriumBankFlowProps) {
    const { t } = useTranslation();
    const { status, isError, refetch } = useMoneriumStatus({ poll: true });
    const hasSeenSetupSuccess = moneriumStore((s) => s.hasSeenSetupSuccess);
    const transferScreen = moneriumFlowStore(selectScreen);
    useMoneriumBeneficiarySync(status?.connection === "connected");
    const screen = deriveSetupScreen(status, hasSeenSetupSuccess);

    // A transfer only survives while the status still allows one.
    useEffect(() => {
        if (screen !== "transfer") moneriumFlowStore.getState().resetTransfer();
    }, [screen]);
    useEffect(() => () => moneriumFlowStore.getState().resetTransfer(), []);

    if (!status) {
        if (isError) {
            return (
                <MoneriumScreen
                    onClose={onClose}
                    title={t("monerium.bankFlow.loadError.title")}
                    description={t("monerium.bankFlow.loadError.description")}
                    ctaLabel={t("monerium.bankFlow.loadError.retry")}
                    ctaOnClick={() => refetch()}
                />
            );
        }
        return (
            <MoneriumScreen onClose={onClose}>
                <Box
                    display={"flex"}
                    alignItems={"center"}
                    justifyContent={"center"}
                    flexGrow={1}
                >
                    <Spinner />
                </Box>
            </MoneriumScreen>
        );
    }

    switch (screen) {
        case "info":
        case "reconnect":
        case "onboarding":
            return <MoneriumConnectScreen variant={screen} onClose={onClose} />;
        case "verification":
        case "linking":
            return <MoneriumPendingScreen variant={screen} onClose={onClose} />;
        case "blocked":
            return (
                <MoneriumScreen
                    onClose={onClose}
                    title={t("monerium.bankFlow.blocked.title")}
                    description={t("monerium.bankFlow.blocked.description")}
                    ctaLabel={t("monerium.bankFlow.blocked.cta")}
                    ctaOnClick={() =>
                        openExternalUrl(MONERIUM_PORTAL_URL[status.environment])
                    }
                />
            );
        case "link":
            return <MoneriumLinkScreen onClose={onClose} />;
        case "success":
            return (
                <MoneriumScreen
                    onClose={onClose}
                    title={t("monerium.bankFlow.success.title")}
                    description={t("monerium.bankFlow.success.description")}
                    ctaLabel={t("monerium.bankFlow.success.cta")}
                    ctaOnClick={() =>
                        moneriumStore.getState().markSetupSuccessSeen()
                    }
                />
            );
        case "transfer":
            switch (transferScreen) {
                case "transfer-recap":
                    return <MoneriumTransferRecapScreen onClose={onClose} />;
                case "transfer-iban":
                    return <MoneriumTransferIbanScreen />;
                default:
                    return <MoneriumTransferAmountScreen onClose={onClose} />;
            }
    }
}
