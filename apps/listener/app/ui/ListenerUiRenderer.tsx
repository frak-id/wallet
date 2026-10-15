import { RpcErrorCodes } from "@frak-labs/frame-connector";
import { recordError } from "@frak-labs/wallet-shared/common/analytics";
import { lazy, Suspense, useErrorBoundary, useState } from "react";
import { type UIRequest, useListenerUI } from "@/ui/ListenerUiProvider";

/**
 * Lazy import of the modal UI
 */
const modalImport = () =>
    import("@/module/modal/component/Modal").then((module) => ({
        default: module.ListenerModal,
    }));
const ListenerModal = lazy(modalImport);

/**
 * Lazy import of the sharing page UI
 */
const sharingImport = () =>
    import("@/module/sharing/component/SharingPage").then((module) => ({
        default: module.ListenerSharingPage,
    }));
const ListenerSharingPage = lazy(sharingImport);

/**
 * Render the listener UI if needed
 */
export function ListenerUiRenderer() {
    const { currentRequest, clearRequest } = useListenerUI();
    const [crashedRequest, setCrashedRequest] = useState<UIRequest>();

    // The iframe is already shown when the UI renders: a crash left unsettled
    // is an invisible overlay over the merchant page and a hanging SDK promise.
    useErrorBoundary((error) => {
        recordError(error, {
            source: "error_boundary",
            context: { surface: currentRequest?.type },
        });
        if (!currentRequest) return;
        void currentRequest.emitter({
            error: {
                code: RpcErrorCodes.serverError,
                message: "The Frak UI failed to render",
            },
        });
        clearRequest();
        setCrashedRequest(currentRequest);
    });

    /**
     * If no request, do not display anything
     */
    if (!currentRequest || currentRequest === crashedRequest) {
        return null;
    }

    /**
     * If the request is a sharing page, display it
     */
    if (currentRequest.type === "sharing") {
        return (
            <Suspense fallback={null}>
                <ListenerSharingPage />
            </Suspense>
        );
    }

    /**
     * If the request is a modal, display it
     */
    return (
        <Suspense fallback={null}>
            <ListenerModal {...currentRequest} />
        </Suspense>
    );
}
