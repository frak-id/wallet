import { log } from "@backend-infrastructure";
import { t } from "@backend-utils";
import type { ProductTypesKey } from "@frak-labs/core-sdk";
import { productTypes } from "@frak-labs/core-sdk";
import { Elysia, status } from "elysia";
import { toHex } from "viem";
import { BusinessContext } from "../../../../domain/business";
import { businessSessionContext } from "../../middleware/session";

export const mintRoutes = new Elysia({ prefix: "/mint" })
    .use(businessSessionContext)
    // Get the dns txt record to set for a domain
    .get(
        "/dnsTxt",
        async ({ query: { domain }, businessSession }) => {
            if (!businessSession) {
                return "";
            }

            return BusinessContext.repositories.dnsCheck.getDnsTxtString({
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
        async ({ query: { domain, setupCode }, businessSession }) => {
            if (!businessSession) {
                return { isDomainValid: false, isAlreadyMinted: false };
            }
            // Normalise the domain
            const normalisedDomain =
                BusinessContext.repositories.dnsCheck.getNormalizedDomain(
                    domain
                );
            // Check if the dns txt is set
            const isDomainValid =
                await BusinessContext.repositories.dnsCheck.isValidDomain({
                    domain: normalisedDomain,
                    owner: businessSession.wallet,
                    setupCode,
                });
            // Check if the product is already minted
            const isAlreadyMinted =
                await BusinessContext.repositories.mint.isExistingProduct(
                    BusinessContext.repositories.mint.precomputeProductId(
                        normalisedDomain
                    )
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
            body: { name, domain, productTypes, setupCode, currency },
        }) => {
            // Ensure the session matches
            if (!businessSession) {
                return status(401, "Invalid session");
            }
            // Normalize the domain
            const normalizedDomain =
                BusinessContext.repositories.dnsCheck.getNormalizedDomain(
                    domain
                );
            // Check if the dns txt is set
            const isValidDomain =
                await BusinessContext.repositories.dnsCheck.isValidDomain({
                    domain: normalizedDomain,
                    owner: businessSession.wallet,
                    setupCode,
                });
            if (!isValidDomain) {
                return status(
                    400,
                    "The domain is invalid (either DNS TXT or invalid setup code)"
                );
            }

            // Mint a product
            try {
                const { mintTxHash, productId, bankResult, interactionResult } =
                    await BusinessContext.repositories.mint.mintProduct({
                        name,
                        domain: normalizedDomain,
                        productTypes,
                        owner: businessSession.wallet,
                        currency,
                    });

                return {
                    txHash: mintTxHash,
                    productId: toHex(productId, { size: 32 }),
                    interactionContract: interactionResult?.interactionContract,
                    bankContract: bankResult?.bank,
                };
            } catch (e) {
                log.error({ error: e }, "Failed to mint product");
                return status(
                    400,
                    (e as Error)?.message ?? "An error occurred"
                );
            }
        },
        {
            body: t.Object({
                name: t.String(),
                domain: t.String(),
                setupCode: t.Optional(t.String()),
                currency: t.Union([
                    t.Literal("usde"),
                    t.Literal("eure"),
                    t.Literal("gbpe"),
                    t.Literal("usdc"),
                ]),
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
