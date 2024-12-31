import { usePrivyCrossAppAuthenticate } from "@/module/common/hook/privy/crossAppPrivyHooks";
import { Button } from "@module/component/Button";
import { useTranslation } from "react-i18next";

/**
 * Do an ecdsa login, and chain the steps
 *  - connect via privy
 *  - sign a message
 * @constructor
 */
export function EcdsaLogin() {
    const { mutate: logIn } = usePrivyCrossAppAuthenticate();
    const { t } = useTranslation();

    return (
        <Button type={"button"} onClick={() => logIn()} variant={"primary"}>
            {t("wallet.login.privy")}
        </Button>
    );
}
