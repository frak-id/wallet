import { Fingerprint } from "@/assets/icons/Fingerprint";
import type { PreviousAuthenticatorModel } from "@/context/common/dexie/PreviousAuthenticatorModel";
import { formatHash } from "@/context/wallet/utils/hashFormatter";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { Panel } from "@/module/common/component/Panel";
import { SquareUser } from "lucide-react";
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
        <Panel asChild={true} size={"small"} withShadow={true}>
            <li>
                <button
                    type={"button"}
                    className={`button ${styles.loginItem__button}`}
                    onClick={async () => {
                        await login({ lastAuthentication });
                        startTransition(() => {
                            router.push("/wallet");
                        });
                    }}
                >
                    <span>
                        <span className={styles.loginItem__name}>
                            <SquareUser /> {lastAuthentication.username}
                        </span>
                        Address: {formatHash(lastAuthentication.wallet)}
                    </span>
                    <span>
                        <Fingerprint
                            width={36}
                            className={styles.loginItem__icon}
                        />
                    </span>
                </button>
            </li>
        </Panel>
    );
}
