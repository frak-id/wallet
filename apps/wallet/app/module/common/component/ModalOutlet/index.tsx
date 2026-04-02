import { SuccessOverlay } from "@/module/common/component/SuccessOverlay";
import { modalStore, selectModal } from "@/module/stores/modalStore";
import { EmptyPendingGainsModal } from "@/module/tokens/component/EmptyPendingGainsModal";
import { EmptyTransferModal } from "@/module/tokens/component/EmptyTransferModal";
import { EmptyTransferredGainsModal } from "@/module/tokens/component/EmptyTransferredGainsModal";
import { PendingGainsModal } from "@/module/tokens/component/PendingGainsModal";

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
        case "successOverlay":
            return <SuccessOverlay visible={true} onDone={closeModal} />;
    }
}
