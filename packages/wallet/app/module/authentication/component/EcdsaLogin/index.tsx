import { usePrivyCrossAppAuthenticate } from "@/module/common/hook/crossAppPrivyHooks";
import { Button } from "@module/component/Button";

/**
 * Do an ecdsa login, and chain the steps
 *  - connect via privy
 *  - sign a message
 * @constructor
 */
export function EcdsaLogin() {
    const { mutate: logIn } = usePrivyCrossAppAuthenticate();

    return (
        <Button type={"button"} onClick={() => logIn()} variant={"primary"}>
            Connect via Privy
        </Button>
    );
}
