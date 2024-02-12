import type { PreviousAuthenticatorModel } from "@/context/common/dexie/PreviousAuthenticatorModel";
import { formatHash } from "@/context/wallet/utils/hashFormatter";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { Fingerprint } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import styles from "./index.module.css";

export function LoginItem({
    lastAuthentication,
}: { lastAuthentication: PreviousAuthenticatorModel }) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const { login } = useLogin();

    return (
        <li className={styles.loginItem}>
            <button
                type={"button"}
                className={styles.loginItem__button}
                onClick={async () => {
                    await login({ lastAuthentication });
                    startTransition(() => {
                        router.push("/");
                    });
                }}
            >
                <span>
                    {formatHash(lastAuthentication.wallet)}
                    <br />
                    ID: {lastAuthentication.username}
                </span>
                <span>
                    <Fingerprint size={36} className={styles.loginItem__icon} />
                </span>
            </button>
        </li>
    );
}
