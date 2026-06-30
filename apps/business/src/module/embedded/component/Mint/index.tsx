import type { Stablecoin } from "@frak-labs/app-essentials";
import { AlertMessage } from "@frak-labs/design-system/components/AlertMessage";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { ExclamationTriangleIcon } from "@frak-labs/design-system/icons";
import { useSearch } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { useListenToDomainNameSetup } from "@/module/dashboard/hooks/dnsRecordHooks";
import { useRegisterMerchant } from "@/module/dashboard/hooks/useMintMyMerchant";

export function EmbeddedMint() {
    const { t } = useTranslation();
    const search = useSearch({ from: "/embedded/_layout/mint" });

    const { name, domain, setupCode, currency, shopDomain } = useMemo(() => {
        const name = search.n;
        const domain = search.d;
        const setupCode = search.sc;
        const currency = search.c as Stablecoin | null;
        const shopDomain = search.sd;

        if (!domain || !setupCode) {
            throw new Error("Missing required parameters");
        }

        return {
            name: name ?? undefined,
            domain,
            setupCode,
            currency: currency ?? ("eure" as Stablecoin),
            shopDomain,
        };
    }, [search]);

    // Check domain setup
    const { data: isDomainValid, isLoading: isDomainValidLoading } =
        useListenToDomainNameSetup({
            domain,
            setupCode,
        });

    // Button to exit
    const close = useCallback(() => {
        // Close the current window
        window.close();
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("embedded.mint.title")}</CardTitle>
                <CardDescription>{t("embedded.mint.subtitle")}</CardDescription>
            </CardHeader>
            {/* Domain validation info */}
            {isDomainValidLoading ? (
                <Spinner />
            ) : isDomainValid ? (
                <DoMintComponent
                    name={name}
                    domain={domain}
                    setupCode={setupCode}
                    currency={currency}
                    shopDomain={shopDomain}
                />
            ) : (
                <Stack space="s">
                    <AlertMessage
                        tone="danger"
                        icon={<ExclamationTriangleIcon />}
                        title={t("embedded.mint.error")}
                        action={{
                            label: t("embedded.mint.alreadyRegistered"),
                            onClick: () =>
                                window.open(
                                    "/dashboard",
                                    "_blank",
                                    "noopener,noreferrer"
                                ),
                        }}
                    />
                    <Button variant="secondary" width="full" onClick={close}>
                        {t("embedded.mint.close")}
                    </Button>
                </Stack>
            )}
        </Card>
    );
}

/**
 * todo: auto close on success
 */
function DoMintComponent({
    name,
    domain,
    setupCode,
    currency,
    shopDomain,
}: {
    name?: string;
    domain: string;
    setupCode: string;
    currency: Stablecoin;
    shopDomain?: string;
}) {
    const { t } = useTranslation();
    // Mint hook
    const {
        infoTxt,
        mutation: { mutate: triggerMintMyContent, isPending, error },
    } = useRegisterMerchant({
        onSuccess: () => {
            // Close the current window
            window.close();
        },
    });

    return (
        <Stack space="s">
            <Text variant="bodySmall" color="secondary">
                <Trans
                    i18nKey="embedded.mint.registering"
                    values={{ domain }}
                    components={{
                        text: (
                            <Text
                                as="span"
                                variant="bodySmall"
                                weight="medium"
                            />
                        ),
                    }}
                />
            </Text>
            <Button
                variant="primary"
                width="full"
                onClick={() =>
                    triggerMintMyContent({
                        name: name ?? domain,
                        domain,
                        setupCode,
                        currency,
                        allowedDomains: shopDomain ? [shopDomain] : undefined,
                    })
                }
                loading={isPending}
                disabled={isPending}
            >
                {isPending ? infoTxt : t("embedded.mint.register")}
            </Button>
            {error && <Text color="error">{error.message}</Text>}
        </Stack>
    );
}
