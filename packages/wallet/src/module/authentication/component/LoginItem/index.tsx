import { formatHash } from "@/context/wallet/utils/hashFormatter";
import { useLogin } from "@/module/authentication/hook/useLogin";
import type { Session } from "@/types/Session";
import { Fingerprint } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import styles from "./index.module.css";

export function LoginItem({ auth }: { auth: Session }) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const { login } = useLogin();

    return (
        <li className={styles.loginItem}>
            <button
                type={"button"}
                className={styles.loginItem__button}
                onClick={async () => {
                    await login(auth.username);
                    startTransition(() => {
                        router.push("/");
                    });
                }}
            >
                <span>
                    {formatHash(auth.wallet.address)}
                    <br />
                    ID: {auth.username}
                </span>
                <span>
                    <Fingerprint size={36} className={styles.loginItem__icon} />
                </span>
            </button>
        </li>
    );
}
