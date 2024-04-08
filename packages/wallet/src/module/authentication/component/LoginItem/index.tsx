import { Fingerprint } from "@/assets/icons/Fingerprint";
import type { PreviousAuthenticatorModel } from "@/context/common/dexie/PreviousAuthenticatorModel";
import { formatHash } from "@/context/wallet/utils/hashFormatter";
import { postAuthRedirectAtom } from "@/module/authentication/atoms/redirection";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { useAtom } from "jotai/index";
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
    const [redirectUrl, setRedirectUrl] = useAtom(postAuthRedirectAtom);

    return (
        <li className={styles.loginItem}>
            <ButtonRipple
                size={"small"}
                className={styles.loginItem__button}
                onClick={async () => {
                    await login({ lastAuthentication });
                    startTransition(() => {
                        if (redirectUrl) {
                            setRedirectUrl(null);
                            window.location.href =
                                decodeURIComponent(redirectUrl);
                            return;
                        }

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
            </ButtonRipple>
        </li>
    );
}
