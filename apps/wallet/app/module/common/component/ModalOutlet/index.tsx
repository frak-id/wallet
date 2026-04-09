import { DetailOverlay } from "@/module/common/component/DetailOverlay";
import { SuccessOverlay } from "@/module/common/component/SuccessOverlay";
import { ExplorerDetail } from "@/module/explorer/component/ExplorerDetail";
import { RewardDetailModal } from "@/module/history/component/RewardDetailModal";
import { MoneriumBankFlow } from "@/module/monerium/component/MoneriumBankFlow";
import { Keypass } from "@/module/onboarding/component/Keypass";
import { RecoveryCodeSuccessModal } from "@/module/recovery-code/component/RecoveryCodeSuccessModal";
import { modalStore, selectModal } from "@/module/stores/modalStore";
import { EmptyPendingGainsModal } from "@/module/tokens/component/EmptyPendingGainsModal";
import { EmptyTransferModal } from "@/module/tokens/component/EmptyTransferModal";
import { EmptyTransferredGainsModal } from "@/module/tokens/component/EmptyTransferredGainsModal";
import { PendingGainsModal } from "@/module/tokens/component/PendingGainsModal";
import { TransferModal } from "@/module/tokens/component/TransferModal";
import { WelcomeDetail } from "@/module/wallet/component/WelcomeCard/WelcomeDetail";

/**
 * Global modal outlet — mounted once at the app root.
 *
 * Reads the current `ModalState` from the Zustand store and renders
 * the matching modal component.  Each modal receives an `onClose`
 * callback that resets the store, keeping modal components completely
 * decoupled from state management.
 */
export function ModalOutlet() {
    const modal = modalStore(selectModal);
    const closeModal = modalStore((s) => s.closeModal);

    if (!modal) return null;

    switch (modal.id) {
        case "emptyTransfer":
            return <EmptyTransferModal onClose={closeModal} />;
        case "emptyPendingGains":
            return <EmptyPendingGainsModal onClose={closeModal} />;
        case "pendingGains":
            return <PendingGainsModal onClose={closeModal} />;
        case "emptyTransferredGains":
            return <EmptyTransferredGainsModal onClose={closeModal} />;
        case "transfer":
            return <TransferModal onClose={closeModal} />;
        case "successOverlay":
            return <SuccessOverlay visible={true} onDone={closeModal} />;
        case "keypass":
            return (
                <Keypass
                    onClose={closeModal}
                    onAuthSuccess={modal.onAuthSuccess}
                />
            );
        case "recoveryCodeSuccess":
            return (
                <RecoveryCodeSuccessModal
                    onClose={closeModal}
                    merchant={modal.merchant}
                />
            );
        case "explorerDetail":
            return (
                <DetailOverlay onClose={closeModal}>
                    {({ handleClose }) => (
                        <ExplorerDetail
                            merchant={modal.merchant}
                            onClose={handleClose}
                        />
                    )}
                </DetailOverlay>
            );
        case "welcomeDetail":
            return (
                <DetailOverlay onClose={closeModal}>
                    {({ handleClose }) => (
                        <WelcomeDetail onClose={handleClose} />
                    )}
                </DetailOverlay>
            );
        case "moneriumBankFlow":
            return (
                <DetailOverlay onClose={closeModal}>
                    {({ handleClose }) => (
                        <MoneriumBankFlow onClose={handleClose} />
                    )}
                </DetailOverlay>
            );
        case "rewardDetail":
            return (
                <DetailOverlay onClose={closeModal}>
                    {({ handleClose }) => (
                        <RewardDetailModal
                            item={modal.item}
                            onClose={handleClose}
                        />
                    )}
                </DetailOverlay>
            );
    }
}
