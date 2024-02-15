import { Panel } from "@/module/common/component/Panel";
import { useAddToHomeScreenPrompt } from "@/module/common/hook/useAddToHomeScreenPrompt";
import { ArrowDownToLine } from "lucide-react";
import styles from "./index.module.css";

export function InstallApp() {
    const { prompt, launchInstallation } = useAddToHomeScreenPrompt();

    return (
        prompt && (
            <Panel withShadow={true} size={"small"}>
                <button
                    type={"button"}
                    className={`button ${styles.wallet__install}`}
                    onClick={launchInstallation}
                >
                    <span>
                        <ArrowDownToLine width={32} height={32} />
                    </span>
                    <span>
                        Install <strong>Nexus Wallet</strong> on your phone for
                        a better experience!
                    </span>
                </button>
            </Panel>
        )
    );
}
