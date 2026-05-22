import type { Stablecoin } from "@frak-labs/app-essentials";
import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { useSearch } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { Button } from "@/module/common/component/Button";
import { Title } from "@/module/common/component/Title";
import { useListenToDomainNameSetup } from "@/module/dashboard/hooks/dnsRecordHooks";
import { useRegisterMerchant } from "@/module/dashboard/hooks/useMintMyMerchant";
import * as styles from "./mint.css";

export function EmbeddedMint() {
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
        <>
            <Title className={styles.title}>Register your shop on Frak</Title>
            <Card>
                <CardHeader>
                    <CardTitle>{`Registering ${domain}`}</CardTitle>
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
                    <>
                        <p className={styles.error}>
                            Can't register your product. Double check that
                            everything is right.
                            <a
                                href="/dashboard"
                                target="_blank"
                                rel="noreferrer"
                                className={styles.link}
                            >
                                Maybe the domain is already registered.
                            </a>
                        </p>
                        <Button
                            variant="secondary"
                            size="small"
                            className={styles.button}
                            onClick={close}
                        >
                            Close
                        </Button>
                    </>
                )}
            </Card>
        </>
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
        <>
            <Button
                variant="secondary"
                size="small"
                className={styles.button}
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
                {isPending ? infoTxt : "Register your shop"}
            </Button>
            {error && <p className={"error"}>{error.message}</p>}
        </>
    );
}
