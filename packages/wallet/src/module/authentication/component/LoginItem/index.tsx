import type { PreviousAuthenticatorModel } from "@/context/common/dexie/PreviousAuthenticatorModel";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { Fingerprint } from "@module/asset/icons/Fingerprint";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { formatHash } from "@module/component/HashDisplay";
import { SquareUser } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toHex } from "viem";
import styles from "./index.module.css";

export function LoginItem({
    lastAuthentication,
}: { lastAuthentication: PreviousAuthenticatorModel }) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const { login } = useLogin();

    return (
        <li className={styles.loginItem}>
            <ButtonRipple
                size={"small"}
                className={styles.loginItem__button}
                onClick={async () => {
                    await login({ lastAuthentication });
                    startTransition(() => {
                        router.push("/wallet");
                    });
                }}
            >
                <span>
                    <span className={styles.loginItem__name}>
                        <SquareUser />{" "}
                        {formatHash({ hash: lastAuthentication.wallet })}
                    </span>
                    Authenticator:{" "}
                    {formatHash({
                        hash: toHex(lastAuthentication.authenticatorId),
                    })}
                </span>
                <span>
                    <Fingerprint
                        width={36}
                        className={styles.loginItem__icon}
                    />
                </span>
            </ButtonRipple>
        </li>
    );
}
