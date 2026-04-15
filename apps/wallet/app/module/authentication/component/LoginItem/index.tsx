import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { PreviousAuthenticatorModel } from "@frak-labs/wallet-shared";
import { useLogin } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { Fingerprint, SquareUser } from "lucide-react";
import { useTransition } from "react";
import { useTranslation } from "react-i18next";
import { type Hex, slice, toHex } from "viem";
import * as styles from "./index.css";

function formatHash({
    hash,
    format = { start: 2, end: 3 },
}: {
    hash: Hex;
    format?: { start: number; end: number };
}) {
    const start = slice(hash, 0, format.start);
    const end = slice(hash, -format.end).replace("0x", "");
    return `${start}...${end}`;
}

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
        <Box as="li" className={styles.loginItem}>
            <Button
                className={styles.loginItem__button}
                onClick={async () => {
                    await login({ lastAuthentication });
                }}
            >
                <Stack space="xxs" align="left">
                    <Box as="span" className={styles.loginItem__name}>
                        <SquareUser size={16} />
                        <Text as="span" variant="bodySmall">
                            {formatHash({ hash: lastAuthentication.wallet })}
                        </Text>
                    </Box>
                    <Text as="span" variant="caption">
                        {t("common.authenticator")}{" "}
                        {formatHash({
                            hash: toHex(lastAuthentication.authenticatorId),
                            format: { start: 4, end: 4 },
                        })}
                    </Text>
                </Stack>
                <Box as="span" className={styles.loginItem__icon}>
                    <Fingerprint size={32} />
                </Box>
            </Button>
        </Box>
    );
}
