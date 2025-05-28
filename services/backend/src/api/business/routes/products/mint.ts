import { log } from "@backend-common";
import { t } from "@backend-utils";
import type { ProductTypesKey } from "@frak-labs/core-sdk";
import { productTypes } from "@frak-labs/core-sdk";
import { Elysia, error } from "elysia";
import { toHex } from "viem";
import {
    DnsCheckRepository,
    MintRepository,
} from "../../../../domain/business";
import { businessSessionContext } from "../../middleware/session";

export const mintRoutes = new Elysia({ prefix: "/mint" })
    .use(businessSessionContext)
    .decorate({
        dnsCheckRepository: new DnsCheckRepository(),
        mintRepository: new MintRepository(),
    })
    // Get the dns txt record to set for a domain
    .get(
        "/dnsTxt",
        async ({ dnsCheckRepository, query: { domain }, businessSession }) => {
            if (!businessSession) {
                return "";
            }

            return dnsCheckRepository.getDnsTxtString({
                domain,
                owner: businessSession.wallet,
            });
        },
        {
            query: t.Object({
                domain: t.String(),
            }),
            response: t.String(),
        }
    )
    // Verify a product mint setup
    .get(
        "/verify",
        async ({
            mintRepository,
            dnsCheckRepository,
            query: { domain, setupCode },
            businessSession,
        }) => {
            if (!businessSession) {
                return { isDomainValid: false, isAlreadyMinted: false };
            }
            // Normalise the domain
            const normalisedDomain =
                dnsCheckRepository.getNormalizedDomain(domain);
            // Check if the dns txt is set
            const isDomainValid = await dnsCheckRepository.isValidDomain({
                domain: normalisedDomain,
                owner: businessSession.wallet,
                setupCode,
            });
            // Check if the product is already minted
            const isAlreadyMinted = await mintRepository.isExistingProduct(
                mintRepository.precomputeProductId(normalisedDomain)
            );
            return { isDomainValid, isAlreadyMinted };
        },
        {
            query: t.Object({
                domain: t.String(),
                setupCode: t.Optional(t.String()),
            }),
            response: t.Object({
                isDomainValid: t.Boolean(),
                isAlreadyMinted: t.Boolean(),
            }),
        }
    )
    // Register a new product
    .put(
        "",
        async ({
            businessSession,
            body: { name, domain, productTypes, setupCode },
            mintRepository,
            dnsCheckRepository,
        }) => {
            // Ensure the session matches
            if (!businessSession) {
                return error(401, "Invalid session");
            }
            // Normalize the domain
            const normalizedDomain =
                dnsCheckRepository.getNormalizedDomain(domain);
            // Check if the dns txt is set
            const isValidDomain = await dnsCheckRepository.isValidDomain({
                domain: normalizedDomain,
                owner: businessSession.wallet,
                setupCode,
            });
            if (!isValidDomain) {
                return error(
                    400,
                    "The domain is invalid (either DNS TXT or invalid setup code)"
                );
            }

            // Mint a product
            try {
                const { mintTxHash, productId, bankResult, interactionResult } =
                    await mintRepository.mintProduct({
                        name,
                        domain: normalizedDomain,
                        productTypes,
                        owner: businessSession.wallet,
                    });

                return {
                    txHash: mintTxHash,
                    productId: toHex(productId),
                    interactionContract: interactionResult?.interactionContract,
                    bankContract: bankResult?.bank,
                };
            } catch (e) {
                log.error({ error: e }, "Failed to mint product");
                return error(400, (e as Error)?.message ?? "An error occurred");
            }
        },
        {
            body: t.Object({
                name: t.String(),
                domain: t.String(),
                setupCode: t.Optional(t.String()),
                productTypes: t.Array(
                    t.UnionEnum(
                        Object.keys(productTypes) as [
                            ProductTypesKey,
                            ...ProductTypesKey[],
                        ]
                    )
                ),
            }),
            response: {
                400: t.String(),
                401: t.String(),
                200: t.Object({
                    txHash: t.Hex(),
                    productId: t.Hex(),
                    interactionContract: t.Optional(t.Hex()),
                    bankContract: t.Optional(t.Hex()),
                }),
            },
        }
    );
