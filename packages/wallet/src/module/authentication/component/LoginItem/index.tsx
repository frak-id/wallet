import type { PreviousAuthenticatorModel } from "@/context/common/dexie/PreviousAuthenticatorModel";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { FingerprintFrak } from "@module/asset/icons/FingerprintFrak";
import { Button } from "@module/component/Button";
import { formatHash } from "@module/component/HashDisplay";
import { SquareUser } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTranslation } from "react-i18next";
import { toHex } from "viem";
import styles from "./index.module.css";

export function LoginItem({
    lastAuthentication,
}: { lastAuthentication: PreviousAuthenticatorModel }) {
    const { t } = useTranslation();
    const router = useRouter();
    const [, startTransition] = useTransition();
    const { login } = useLogin({
        onSuccess: () => {
            startTransition(() => {
                router.push("/wallet");
            });
        },
    });

    return (
        <li className={styles.loginItem}>
            <Button
                size={"small"}
                className={styles.loginItem__button}
                onClick={async () => {
                    await login({ lastAuthentication });
                }}
            >
                <span>
                    <span className={styles.loginItem__name}>
                        <SquareUser />{" "}
                        {formatHash({ hash: lastAuthentication.wallet })}
                    </span>
                    {t("common.authenticator")}{" "}
                    {formatHash({
                        hash: toHex(lastAuthentication.authenticatorId),
                    })}
                </span>
                <span>
                    <FingerprintFrak
                        width={36}
                        className={styles.loginItem__icon}
                    />
                </span>
            </Button>
        </li>
    );
}
