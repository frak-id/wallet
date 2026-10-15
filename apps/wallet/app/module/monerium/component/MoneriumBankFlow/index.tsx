import { Box } from "@frak-labs/design-system/components/Box";
import { DetailSheet } from "@frak-labs/design-system/components/DetailSheet";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { useEffect } from "react";
import { useMoneriumBeneficiarySync } from "@/module/monerium/hooks/useMoneriumBeneficiarySync";
import { useMoneriumStatus } from "@/module/monerium/hooks/useMoneriumStatus";
import {
    moneriumFlowStore,
    selectScreen,
} from "@/module/monerium/store/moneriumFlowStore";
import { moneriumStore } from "@/module/monerium/store/moneriumStore";
import { deriveSetupScreen } from "@/module/monerium/utils/deriveSetupScreen";
import { MoneriumBlockedScreen } from "./MoneriumBlockedScreen";
import { MoneriumConnectScreen } from "./MoneriumConnectScreen";
import { MoneriumLinkScreen } from "./MoneriumLinkScreen";
import { MoneriumLoadErrorScreen } from "./MoneriumLoadErrorScreen";
import { MoneriumPendingScreen } from "./MoneriumPendingScreen";
import { MoneriumSuccessScreen } from "./MoneriumSuccessScreen";
import { MoneriumTransferAmountScreen } from "./MoneriumTransferAmountScreen";
import { MoneriumTransferIbanScreen } from "./MoneriumTransferIbanScreen";
import { MoneriumTransferRecapScreen } from "./MoneriumTransferRecapScreen";

type MoneriumBankFlowProps = {
    onClose: () => void;
};

/**
 * Root of the Monerium bank-transfer flow.
 *
 * The setup screen is derived from the single status query on every render,
 * so the sheet opens on the right screen. Once setup is done, the transfer
 * screens are navigated through `moneriumFlowStore`.
 *
 * Wrapped by `DetailOverlay` in the `ModalOutlet`.
 */
export function MoneriumBankFlow({ onClose }: MoneriumBankFlowProps) {
    const { status, isError, refetch } = useMoneriumStatus({ poll: true });
    const hasSeenSetupSuccess = moneriumStore((s) => s.hasSeenSetupSuccess);
    const transferScreen = moneriumFlowStore(selectScreen);
    useMoneriumBeneficiarySync(status?.connection === "connected");

    useEffect(() => {
        return () => {
            moneriumFlowStore.getState().resetTransfer();
        };
    }, []);

    const screen = deriveSetupScreen(status, hasSeenSetupSuccess);

    if (screen === "loading" && isError) {
        return (
            <MoneriumLoadErrorScreen
                onClose={onClose}
                onRetry={() => refetch()}
            />
        );
    }

    switch (screen) {
        case "loading":
            return (
                <DetailSheet>
                    <Box
                        display={"flex"}
                        alignItems={"center"}
                        justifyContent={"center"}
                        flexGrow={1}
                    >
                        <Spinner />
                    </Box>
                </DetailSheet>
            );
        case "info":
        case "reconnect":
        case "onboarding":
            return <MoneriumConnectScreen variant={screen} onClose={onClose} />;
        case "verification":
        case "linking":
            return <MoneriumPendingScreen variant={screen} onClose={onClose} />;
        case "blocked":
            return (
                <MoneriumBlockedScreen
                    onClose={onClose}
                    environment={status?.environment ?? "sandbox"}
                />
            );
        case "link":
            return <MoneriumLinkScreen onClose={onClose} />;
        case "success":
            return <MoneriumSuccessScreen onClose={onClose} />;
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
