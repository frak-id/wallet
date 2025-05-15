import { ButtonLabel } from "@/module/common/component/ButtonLabel";
import { Panel } from "@/module/common/component/Panel";
import { pwaInstallRefAtom } from "@/module/common/component/PwaInstall";
import { WebApp } from "@shared/module/asset/icons/WebApp";
import { Button } from "@shared/module/component/Button";
import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { Trans } from "react-i18next";

export function InstallApp() {
    const pwaInstallRef = useAtomValue(pwaInstallRefAtom);

    const handleInstall = useCallback(() => {
        const pwaInstall = pwaInstallRef?.current;
        if (!pwaInstall) return;
        pwaInstall.showDialog(true);
    }, [pwaInstallRef]);

    return (
        !pwaInstallRef?.current?.isUnderStandaloneMode && (
            <Panel variant={"invisible"} size={"none"}>
                <Button
                    blur={"blur"}
                    width={"full"}
                    align={"left"}
                    gap={"big"}
                    onClick={handleInstall}
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
