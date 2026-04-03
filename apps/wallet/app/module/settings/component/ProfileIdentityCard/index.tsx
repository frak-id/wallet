import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon, CopyIcon } from "@frak-labs/design-system/icons";
import {
    selectEcdsaSession,
    selectWebauthnSession,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHydrated } from "remix-utils/use-hydrated";
import { type Hex, slice, toHex } from "viem";
import { useAccount } from "wagmi";
import * as styles from "./index.css";

function formatHash({
    hash,
    format = { start: 6, end: 4 },
}: {
    hash: Hex;
    format?: { start: number; end: number };
}) {
    if (!hash) return undefined;
    const start = slice(hash, 0, format.start);
    const end = slice(hash, -format.end).replace("0x", "");
    return `${start}...${end}`;
}

function IdentityRow({
    label,
    value,
    displayValue,
}: {
    label: string;
    value: Hex;
    displayValue: string;
}) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return;

        const timeoutId = window.setTimeout(() => {
            setCopied(false);
        }, 2000);

        return () => window.clearTimeout(timeoutId);
    }, [copied]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
        } catch {
            // Ignore clipboard failures on unsupported environments.
        }
    };

    return (
        <Box
            as="button"
            type="button"
            aria-label={copied ? t("common.copied") : t("common.copyAddress")}
            className={styles.row}
            onClick={handleCopy}
        >
            <Box className={styles.rowContent}>
                <Text as="span" variant="label" color={"secondary"}>
                    {label}
                </Text>
                <Box className={styles.valueRow}>
                    <Text
                        as="span"
                        variant="label"
                        color="secondary"
                        className={styles.value}
                    >
                        {displayValue}
                    </Text>
                    {copied ? (
                        <CheckIcon
                            width={16}
                            height={16}
                            className={styles.copyIcon}
                        />
                    ) : (
                        <CopyIcon
                            width={16}
                            height={16}
                            className={styles.copyIcon}
                        />
                    )}
                </Box>
            </Box>
        </Box>
    );
}

export function ProfileIdentityCard() {
    const { t } = useTranslation();
    const isHydrated = useHydrated();
    const { address } = useAccount();
    const webauthnWallet = sessionStore(selectWebauthnSession);
    const ecdsaWallet = sessionStore(selectEcdsaSession);

    const authenticatorValue = useMemo(() => {
        if (!webauthnWallet) return null;
        const authenticatorId = toHex(webauthnWallet.authenticatorId);
        return {
            value: authenticatorId,
            displayValue:
                formatHash({
                    hash: authenticatorId,
                    format: { start: 8, end: 6 },
                }) ?? authenticatorId,
        };
    }, [webauthnWallet]);

    const walletValue = useMemo(() => {
        if (!address) return null;
        return {
            value: address,
            displayValue:
                formatHash({ hash: address, format: { start: 8, end: 6 } }) ??
                address,
        };
    }, [address]);

    const ecdsaValue = useMemo(() => {
        if (!ecdsaWallet) return null;
        const publicKey = toHex(ecdsaWallet.publicKey);
        return {
            value: publicKey,
            displayValue:
                formatHash({ hash: publicKey, format: { start: 8, end: 6 } }) ??
                publicKey,
        };
    }, [ecdsaWallet]);

    if (!isHydrated) {
        return null;
    }

    if (!walletValue) {
        return null;
    }

    return (
        <Card padding="none" className={styles.card}>
            {webauthnWallet && authenticatorValue ? (
                <IdentityRow
                    label={t("common.authenticator")}
                    value={authenticatorValue.value}
                    displayValue={authenticatorValue.displayValue}
                />
            ) : null}
            {ecdsaWallet && ecdsaValue ? (
                <IdentityRow
                    label={t("wallet.settings.ecdsaWallet")}
                    value={ecdsaValue.value}
                    displayValue={ecdsaValue.displayValue}
                />
            ) : null}
            {walletValue ? (
                <IdentityRow
                    label={t("common.wallet")}
                    value={walletValue.value}
                    displayValue={walletValue.displayValue}
                />
            ) : null}
        </Card>
    );
}
