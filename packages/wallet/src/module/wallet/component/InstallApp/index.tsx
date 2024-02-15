import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
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
                    <Title icon={<ArrowDownToLine width={32} height={32} />}>
                        Install <strong>Nexus Wallet</strong> on your phone for
                        a better experience!
                    </Title>
                </button>
            </Panel>
        )
    );
}
