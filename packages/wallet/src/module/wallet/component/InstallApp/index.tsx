import { ButtonLabel } from "@/module/common/component/ButtonLabel";
import { Panel } from "@/module/common/component/Panel";
import { useAddToHomeScreenPrompt } from "@/module/common/hook/useAddToHomeScreenPrompt";
import { WebApp } from "@module/asset/icons/WebApp";
import { Button } from "@module/component/Button";
import { Trans } from "react-i18next";

export function InstallApp() {
    const { prompt, launchInstallation } = useAddToHomeScreenPrompt();

    return (
        prompt && (
            <Panel variant={"invisible"} size={"none"}>
                <Button
                    blur={"blur"}
                    width={"full"}
                    align={"left"}
                    gap={"big"}
                    onClick={() => launchInstallation()}
                    leftIcon={<WebApp />}
                >
                    <ButtonLabel>
                        <Trans i18nKey={"wallet.installWebApp"} />
                    </ButtonLabel>
                </Button>
            </Panel>
        )
    );
}
