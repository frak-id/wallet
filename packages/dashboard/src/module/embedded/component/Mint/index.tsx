"use client";

import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useListenToDomainNameSetup } from "@/module/dashboard/hooks/dnsRecordHooks";
import { useMintMyProduct } from "@/module/dashboard/hooks/useMintMyProduct";
import { Button } from "@frak-labs/shared/module/component/Button";
import { Spinner } from "@frak-labs/shared/module/component/Spinner";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import styles from "./index.module.css";

/**
 *
 * todo: query param with: domain, setup code, wallet address, product types
 */
export function EmbeddedMint() {
    const searchParams = useSearchParams();

    const { name, domain, setupCode, productTypes } = useMemo(() => {
        const name = searchParams?.get("n");
        const domain = searchParams?.get("d");
        const setupCode = searchParams?.get("sc");
        const productTypes = searchParams?.get("pt");

        if (!domain || !setupCode || !productTypes) {
            throw new Error("Missing required parameters");
        }

        return {
            name: name ?? undefined,
            domain,
            setupCode,
            productTypes,
        };
    }, [searchParams]);

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
            <Panel withBadge={false} title={`Registering ${domain}`}>
                {/* Domain validation info */}
                {isDomainValidLoading ? (
                    <Spinner />
                ) : isDomainValid ? (
                    <DoMintComponent
                        name={name}
                        domain={domain}
                        setupCode={setupCode}
                        productTypes={productTypes}
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
            </Panel>
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
    productTypes,
}: {
    name?: string;
    domain: string;
    setupCode: string;
    productTypes: string;
}) {
    // Mint hook
    const {
        infoTxt,
        mutation: { mutate: triggerMintMyContent, isPending, error },
    } = useMintMyProduct({
        onSuccess: () => {
            // Close the current window
            window.close();
        },
    });

    // Map the product types to the correct type
    const productTypesArray = productTypes.split(",") as (
        | "dapp"
        | "press"
        | "webshop"
        | "retail"
        | "referral"
        | "purchase"
    )[];

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
                        productTypes: productTypesArray,
                    })
                }
                isLoading={isPending}
                disabled={isPending}
            >
                {isPending ? infoTxt : "Register your shop"}
            </Button>
            {error && <p className={"error"}>{error.message}</p>}
        </>
    );
}
