import { Box } from "@frak-labs/design-system/components/Box";
import { DetailSheet } from "@frak-labs/design-system/components/DetailSheet";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { useMoneriumAddresses } from "@/module/monerium/hooks/useMoneriumAddresses";
import { useMoneriumAuth } from "@/module/monerium/hooks/useMoneriumAuth";
import { useMoneriumProfile } from "@/module/monerium/hooks/useMoneriumProfile";
import { moneriumStore } from "@/module/monerium/store/moneriumStore";
import { MoneriumInfoScreen } from "./MoneriumInfoScreen";
import { MoneriumKycScreen } from "./MoneriumKycScreen";
import { MoneriumLinkScreen } from "./MoneriumLinkScreen";
import { MoneriumSuccessScreen } from "./MoneriumSuccessScreen";
import { MoneriumTransferScreen } from "./MoneriumTransferScreen";

type FlowStep = "info" | "kyc" | "link" | "success" | "transfer" | "loading";

/**
 * Determines which screen to show based on the current Monerium state.
 *
 *  1. Not connected          → "info"    (show explanation, CTA → OAuth)
 *  2. Connected, KYC pending → "kyc"     (redirect to Monerium)
 *  3. KYC done, wallet unlinked → "link" (sign + link wallet)
 *  4. All done, first time   → "success" (shown once)
 *  5. All done               → "transfer" (placeholder)
 */
function useFlowStep(): FlowStep {
    const { isConnected } = useMoneriumAuth();
    const { profileState, isLoading: isProfileLoading } = useMoneriumProfile();
    const { isWalletLinked, isLoading: isAddressesLoading } =
        useMoneriumAddresses();
    const hasSeenSetupSuccess = moneriumStore((s) => s.hasSeenSetupSuccess);

    if (!isConnected) return "info";

    if (isProfileLoading) return "loading";

    const needsKyc =
        !profileState ||
        profileState === "created" ||
        profileState === "pending";
    if (needsKyc) return "kyc";

    if (profileState === "approved" && isAddressesLoading) return "loading";
    if (profileState === "approved" && !isWalletLinked) return "link";
    if (profileState === "approved" && isWalletLinked && !hasSeenSetupSuccess)
        return "success";

    return "transfer";
}

type MoneriumBankFlowProps = {
    onClose: () => void;
};

/**
 * Root component of the Monerium bank-transfer flow.
 *
 * Reads the current Monerium state and renders the appropriate step.
 * Wrapped by `DetailOverlay` in the `ModalOutlet`.
 */
export function MoneriumBankFlow({ onClose }: MoneriumBankFlowProps) {
    const step = useFlowStep();

    if (step === "loading") {
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

    switch (step) {
        case "info":
            return <MoneriumInfoScreen onClose={onClose} />;
        case "kyc":
            return <MoneriumKycScreen onClose={onClose} />;
        case "link":
            return <MoneriumLinkScreen onClose={onClose} />;
        case "success":
            return <MoneriumSuccessScreen onClose={onClose} />;
        case "transfer":
            return <MoneriumTransferScreen onClose={onClose} />;
    }
}
