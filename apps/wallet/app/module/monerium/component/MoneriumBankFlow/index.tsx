import { isRunningInProd } from "@frak-labs/app-essentials";
import { Box } from "@frak-labs/design-system/components/Box";
import { DetailSheet } from "@frak-labs/design-system/components/DetailSheet";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { useEffect } from "react";
import { useMoneriumAddresses } from "@/module/monerium/hooks/useMoneriumAddresses";
import { useMoneriumAuth } from "@/module/monerium/hooks/useMoneriumAuth";
import { useMoneriumProfile } from "@/module/monerium/hooks/useMoneriumProfile";
import {
    type MoneriumFlowScreen,
    moneriumFlowStore,
    selectScreen,
} from "@/module/monerium/store/moneriumFlowStore";
import { moneriumStore } from "@/module/monerium/store/moneriumStore";
import { MoneriumConnectScreen } from "./MoneriumConnectScreen";
import { MoneriumLinkScreen } from "./MoneriumLinkScreen";
import { MoneriumSuccessScreen } from "./MoneriumSuccessScreen";
import { MoneriumTransferAmountScreen } from "./MoneriumTransferAmountScreen";
import { MoneriumTransferIbanScreen } from "./MoneriumTransferIbanScreen";
import { MoneriumTransferRecapScreen } from "./MoneriumTransferRecapScreen";

/**
 * Pure derivation: given the current Monerium account state, return the
 * setup screen that should be shown.  Returns `null` when the user has
 * completed setup (i.e. ready for transfer).
 */
function deriveSetupScreen(params: {
    isConnected: boolean;
    profileState: string | null;
    isProfileLoading: boolean;
    isWalletLinked: boolean | undefined;
    isAddressesLoading: boolean;
    hasSeenSetupSuccess: boolean;
}): MoneriumFlowScreen {
    if (!params.isConnected) return "info";
    if (params.isProfileLoading) return "loading";

    const needsKyc =
        !params.profileState ||
        (isRunningInProd &&
            (params.profileState === "created" ||
                params.profileState === "pending"));
    if (needsKyc) return "kyc";

    if (params.profileState === "approved" && params.isAddressesLoading)
        return "loading";
    if (params.profileState === "approved" && !params.isWalletLinked)
        return "link";
    if (
        params.profileState === "approved" &&
        params.isWalletLinked &&
        !params.hasSeenSetupSuccess
    )
        return "success";

    return "transfer-amount";
}

/**
 * Watches Monerium auth / profile / address state and drives the flow
 * store to the correct setup screen.  Transfer screens are navigated
 * imperatively by the user, so we skip auto-transitions once there.
 */
function useMoneriumFlowSync() {
    const { isConnected } = useMoneriumAuth();
    const { profileState, isLoading: isProfileLoading } = useMoneriumProfile();
    const { isWalletLinked, isLoading: isAddressesLoading } =
        useMoneriumAddresses();
    const hasSeenSetupSuccess = moneriumStore((s) => s.hasSeenSetupSuccess);

    useEffect(() => {
        const { screen, goTo } = moneriumFlowStore.getState();
        const target = deriveSetupScreen({
            isConnected,
            profileState,
            isProfileLoading,
            isWalletLinked,
            isAddressesLoading,
            hasSeenSetupSuccess,
        });

        // Don't override an active transfer sub-flow unless disconnected
        if (screen.startsWith("transfer-") && target.startsWith("transfer-"))
            return;

        goTo(target);
    }, [
        isConnected,
        profileState,
        isProfileLoading,
        isWalletLinked,
        isAddressesLoading,
        hasSeenSetupSuccess,
    ]);
}

type MoneriumBankFlowProps = {
    onClose: () => void;
};

/**
 * Root component of the Monerium bank-transfer flow.
 *
 * Uses a flat Zustand store (`moneriumFlowStore`) to manage which screen
 * is visible.  Setup screens are auto-driven by `useMoneriumFlowSync`;
 * transfer screens are navigated imperatively by user actions.
 *
 * Wrapped by `DetailOverlay` in the `ModalOutlet`.
 */
export function MoneriumBankFlow({ onClose }: MoneriumBankFlowProps) {
    useMoneriumFlowSync();
    const screen = moneriumFlowStore(selectScreen);

    // Reset transfer form data when the flow unmounts
    useEffect(() => {
        return () => {
            moneriumFlowStore.getState().resetTransfer();
        };
    }, []);

    if (screen === "loading") {
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
    }

    switch (screen) {
        case "info":
            return <MoneriumConnectScreen variant="info" onClose={onClose} />;
        case "kyc":
            return <MoneriumConnectScreen variant="kyc" onClose={onClose} />;
        case "link":
            return <MoneriumLinkScreen onClose={onClose} />;
        case "success":
            return <MoneriumSuccessScreen onClose={onClose} />;
        case "transfer-amount":
            return <MoneriumTransferAmountScreen onClose={onClose} />;
        case "transfer-recap":
            return <MoneriumTransferRecapScreen onClose={onClose} />;
        case "transfer-iban":
            return <MoneriumTransferIbanScreen />;
    }
}
