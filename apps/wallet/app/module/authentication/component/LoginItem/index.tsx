import { Button } from "@frak-labs/ui/component/Button";
import { formatHash } from "@frak-labs/ui/component/HashDisplay";
import { FingerprintFrak } from "@frak-labs/ui/icons/FingerprintFrak";
import type { PreviousAuthenticatorModel } from "@frak-labs/wallet-shared";
import { useLogin } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { SquareUser } from "lucide-react";
import { useTransition } from "react";
import { useTranslation } from "react-i18next";
import { toHex } from "viem";
import styles from "./index.module.css";

export function LoginItem({
    lastAuthentication,
}: {
    lastAuthentication: PreviousAuthenticatorModel;
}) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [, startTransition] = useTransition();
    const { login } = useLogin({
        onSuccess: () => {
            startTransition(() => {
                navigate({ to: "/wallet" });
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
