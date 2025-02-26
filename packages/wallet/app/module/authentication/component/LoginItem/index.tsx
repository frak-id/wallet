import { useLogin } from "@/module/authentication/hook/useLogin";
import type { PreviousAuthenticatorModel } from "@/module/common/storage/dexie/PreviousAuthenticatorModel";
import { FingerprintFrak } from "@shared/module/asset/icons/FingerprintFrak";
import { Button } from "@shared/module/component/Button";
import { formatHash } from "@shared/module/component/HashDisplay";
import { SquareUser } from "lucide-react";
import { useTransition } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toHex } from "viem";
import styles from "./index.module.css";

export function LoginItem({
    lastAuthentication,
}: { lastAuthentication: PreviousAuthenticatorModel }) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [, startTransition] = useTransition();
    const { login } = useLogin({
        onSuccess: () => {
            startTransition(() => {
                navigate("/wallet");
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
