import {
    isAndroid,
    isIOS,
    isTauri,
} from "@frak-labs/app-essentials/utils/platform";
import { useState } from "react";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { getInstallReferrer } from "@/module/onboarding/utils/installReferrer";
import { startWebAuthSession } from "@/module/onboarding/utils/webAuthSession";
import styles from "./index.module.css";

type ResultState = {
    data: string | null;
    error: string | null;
    loading: boolean;
};

const initialState: ResultState = {
    data: null,
    error: null,
    loading: false,
};

function getConnectUrl() {
    const origin = window.location.origin.startsWith("tauri://")
        ? (process.env.FRAK_WALLET_URL ?? "https://wallet-dev.frak.id")
        : window.location.origin;
    return `${origin}/connect`;
}

export function MobileOnboardingPoc() {
    const [iosResult, setIosResult] = useState<ResultState>(initialState);
    const [androidResult, setAndroidResult] =
        useState<ResultState>(initialState);

    if (!isTauri()) return null;

    const handleTestIosSheet = async () => {
        setIosResult({ data: null, error: null, loading: true });
        try {
            const result = await startWebAuthSession(
                getConnectUrl(),
                "frakwallet"
            );
            setIosResult({
                data: JSON.stringify(result, null, 2),
                error: null,
                loading: false,
            });
        } catch (e) {
            setIosResult({
                data: null,
                error: e instanceof Error ? e.message : String(e),
                loading: false,
            });
        }
    };

    const handleReadReferrer = async () => {
        setAndroidResult({ data: null, error: null, loading: true });
        try {
            const result = await getInstallReferrer();
            setAndroidResult({
                data: JSON.stringify(result, null, 2),
                error: null,
                loading: false,
            });
        } catch (e) {
            setAndroidResult({
                data: null,
                error: e instanceof Error ? e.message : String(e),
                loading: false,
            });
        }
    };

    return (
        <Panel size={"small"}>
            <Title>Mobile Onboarding POC</Title>
            <div className={styles.onboarding__container}>
                {isIOS() && (
                    <div className={styles.onboarding__section}>
                        <h3>iOS — ASWebAuthenticationSession</h3>
                        <p style={{ fontSize: "12px", margin: 0 }}>
                            Opens a Safari sheet that retrieves install context
                            from the backend and redirects back with the data.
                        </p>
                        <button
                            type="button"
                            className={styles.onboarding__button}
                            onClick={handleTestIosSheet}
                            disabled={iosResult.loading}
                        >
                            {iosResult.loading
                                ? "Opening Safari sheet..."
                                : "Test Safari Sheet"}
                        </button>
                        <ResultDisplay result={iosResult} />
                    </div>
                )}

                {isAndroid() && (
                    <div className={styles.onboarding__section}>
                        <h3>Android — Play Install Referrer</h3>
                        <p style={{ fontSize: "12px", margin: 0 }}>
                            Reads the install referrer string passed through the
                            Play Store URL.
                        </p>
                        <button
                            type="button"
                            className={styles.onboarding__button}
                            onClick={handleReadReferrer}
                            disabled={androidResult.loading}
                        >
                            {androidResult.loading
                                ? "Reading referrer..."
                                : "Read Install Referrer"}
                        </button>
                        <ResultDisplay result={androidResult} />
                    </div>
                )}
            </div>
        </Panel>
    );
}

function ResultDisplay({ result }: { result: ResultState }) {
    if (!result.data && !result.error) return null;

    if (result.error) {
        return (
            <div
                className={`${styles.onboarding__result} ${styles["onboarding__result--error"]}`}
            >
                Error: {result.error}
            </div>
        );
    }

    return (
        <div
            className={`${styles.onboarding__result} ${styles["onboarding__result--success"]}`}
        >
            {result.data}
        </div>
    );
}
