import { usePrivyLogin } from "@/module/authentication/hook/usePrivyLogin";
import { Button } from "@module/component/Button";
import { useTranslation } from "react-i18next";

/**
 * Do an ecdsa login, and chain the steps
 *  - connect via privy
 *  - sign a message
 * @constructor
 */
export function EcdsaLogin() {
    const { privyLogin } = usePrivyLogin();
    const { t } = useTranslation();

    return (
        <Button
            type={"button"}
            onClick={() => privyLogin()}
            variant={"primary"}
        >
            {t("wallet.login.privy")}
        </Button>
    );
}
