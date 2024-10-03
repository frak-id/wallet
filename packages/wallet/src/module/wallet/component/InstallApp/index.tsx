import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useAddToHomeScreenPrompt } from "@/module/common/hook/useAddToHomeScreenPrompt";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { ArrowDownToLine } from "lucide-react";
import styles from "./index.module.css";

export function InstallApp() {
    const { prompt, launchInstallation } = useAddToHomeScreenPrompt();

    return (
        prompt && (
            <Panel variant={"empty"} size={"none"}>
                <ButtonRipple
                    size={"small"}
                    className={`button ${styles.wallet__install}`}
                    onClick={launchInstallation}
                >
                    <Title icon={<ArrowDownToLine width={32} height={32} />}>
                        Install <strong>Frak Wallet</strong> on your phone for a
                        better experience!
                    </Title>
                </ButtonRipple>
            </Panel>
        )
    );
}
