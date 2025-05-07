"use client";

import { useListenToDomainNameSetup } from "@/module/dashboard/hooks/dnsRecordHooks";
import { useMintMyProduct } from "@/module/dashboard/hooks/useMintMyProduct";
import { Button } from "@frak-labs/shared/module/component/Button";
import { Spinner } from "@frak-labs/shared/module/component/Spinner";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

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
        <div>
            <h1>Mint</h1>
            <br />
            <p>Registering your {domain} website on Frak</p>
            <br />
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
                    <p>
                        Can't register your product. Double check that
                        everything is right.
                    </p>
                    <br />
                    <Button onClick={close}>Exit</Button>
                </>
            )}
        </div>
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
                Register product
            </Button>
            {infoTxt && <p>{infoTxt}</p>}
            {error && <p>{error.message}</p>}
        </>
    );
}
