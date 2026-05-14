import { lazy, Suspense } from "react";
import { DetailOverlay } from "@/module/common/component/DetailOverlay";
import { RecoveryCodeSuccessModal } from "@/module/recovery-code/component/RecoveryCodeSuccessModal";
import { modalStore, selectModal } from "@/module/stores/modalStore";
import { EmptyPendingGainsModal } from "@/module/tokens/component/EmptyPendingGainsModal";
import { EmptyTransferModal } from "@/module/tokens/component/EmptyTransferModal";
import { EmptyTransferredGainsModal } from "@/module/tokens/component/EmptyTransferredGainsModal";
import { TransferModal } from "@/module/tokens/component/TransferModal";

// Lazy-loaded: each modal is reached only via explicit user action and pulls a
// non-trivial subtree (e.g. MoneriumBankFlow ~70KB across 12 files; Keypass pulls
// AuthenticateWithPhone → LaunchPairing → cuer + react-hook-form). Keeping them
// out of the entry chunk shrinks first paint by ~150KB. Modal animations mask
// the ~50ms chunk fetch so `fallback={null}` is fine.
const ExplorerDetail = lazy(() =>
    import("@/module/explorer/component/ExplorerDetail").then((m) => ({
        default: m.ExplorerDetail,
    }))
);
const MoneriumBankFlow = lazy(() =>
    import("@/module/monerium/component/MoneriumBankFlow").then((m) => ({
        default: m.MoneriumBankFlow,
    }))
);
const Keypass = lazy(() =>
    import("@/module/onboarding/component/Keypass").then((m) => ({
        default: m.Keypass,
    }))
);
const RewardDetailModal = lazy(() =>
    import("@/module/history/component/RewardDetailModal").then((m) => ({
        default: m.RewardDetailModal,
    }))
);
const MoneriumOrderDetailModal = lazy(() =>
    import("@/module/history/component/MoneriumOrderDetailModal").then((m) => ({
        default: m.MoneriumOrderDetailModal,
    }))
);
const EditReferralCodeSheet = lazy(() =>
    import("@/module/referral/component/EditReferralCodeSheet").then((m) => ({
        default: m.EditReferralCodeSheet,
    }))
);
const WelcomeDetail = lazy(() =>
    import("@/module/wallet/component/WelcomeCard/WelcomeDetail").then((m) => ({
        default: m.WelcomeDetail,
    }))
);
const PendingGainsModal = lazy(() =>
    import("@/module/tokens/component/PendingGainsModal").then((m) => ({
        default: m.PendingGainsModal,
    }))
);

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

    return (
        <Suspense fallback={null}>{renderModal(modal, closeModal)}</Suspense>
    );
}

function renderModal(
    modal: NonNullable<ReturnType<typeof selectModal>>,
    closeModal: () => void
) {
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
        case "keypass":
            return (
                <Keypass
                    onClose={closeModal}
                    onAuthSuccess={modal.onAuthSuccess}
                    email={modal.email}
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
        case "moneriumOrderDetail":
            return (
                <DetailOverlay onClose={closeModal}>
                    {({ handleClose }) => (
                        <MoneriumOrderDetailModal
                            order={modal.order}
                            onClose={handleClose}
                        />
                    )}
                </DetailOverlay>
            );
        case "editReferralCode":
            return (
                <DetailOverlay onClose={closeModal} variant="bottomSheet">
                    {({ handleClose }) => (
                        <EditReferralCodeSheet
                            onClose={handleClose}
                            onSaved={modal.onSaved}
                        />
                    )}
                </DetailOverlay>
            );
    }
}
