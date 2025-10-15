import { Button } from "@frak-labs/ui/component/Button";
import { useAtomValue, useSetAtom } from "jotai";
import { KeyRound } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { demoPrivateKeyAtom } from "@/module/common/atoms/session";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";

export function PrivateKey() {
    const { t } = useTranslation();
    const privateKey = useAtomValue(demoPrivateKeyAtom);

    if (privateKey) {
        return (
            <Panel size={"small"}>
                <Title icon={<KeyRound size={32} />}>
                    {t("wallet.settings.privateKey")}
                </Title>
                <DeletePrivateKey />
            </Panel>
        );
    }

    return null;
}

function DeletePrivateKey() {
    const { t } = useTranslation();
    const setPrivateKey = useSetAtom(demoPrivateKeyAtom);

    const deletePrivateKey = useCallback(() => {
        setPrivateKey(null);
    }, [setPrivateKey]);

    return (
        <Button variant={"primary"} size={"small"} onClick={deletePrivateKey}>
            {t("wallet.settings.deletePrivateKey")}
        </Button>
    );
}
