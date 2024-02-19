import type { UiState } from "@/types/Unlock";

export function UnlockError({ error }: { error: UiState["error"] }) {
    if (!error) {
        return null;
    }

    return (
        <>
            An error occurred
            <br />
            <br />
            Click to retry the transaction
        </>
    );
}
