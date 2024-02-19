import styles from "@/module/paywall/component/Unlock/index.module.css";
import type { UiState } from "@/types/Unlock";

export function UnlockLoading({ loading }: { loading: UiState["loading"] }) {
    if (!loading) {
        return null;
    }

    return (
        <>
            {loading.info === "idle" ? (
                "Click to launch the unlock"
            ) : (
                <span className={styles.unlock__loading}>
                    Checking everything{" "}
                    <span className={"dotsLoading"}>...</span>
                </span>
            )}
        </>
    );
}
