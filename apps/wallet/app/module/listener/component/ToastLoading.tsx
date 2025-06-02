import { useIsMutating } from "@tanstack/react-query";
import { useSdkCleanup } from "../hooks/useSdkCleanup";

export function ToastLoading() {
    const cleanup = useSdkCleanup();

    const isMutating = useIsMutating();

    // Early exit if we don't have any mutation in progress
    if (isMutating < 1) return null;

    // Otherwise, display the cleanup toast
    // before the 5sec treeshold, just display a loading indicator
    // after 5sec after the mutating is unchanged, link to the troubleshooting section + the options to logout and redo a login / pairing (cleanup hook)
    return (
        <div>
            Stuck? You can try to{" "}
            <button type="button" onClick={cleanup}>
                Cleanup
            </button>
            . (this will logout and you will need to redo a login / pairing)
        </div>
    );
}
