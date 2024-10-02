import { adminWalletContext, nextSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import type { ProductTypesKey } from "@frak-labs/nexus-sdk/core";
import { productTypes } from "@frak-labs/nexus-sdk/core";
import { Elysia } from "elysia";
import { toHex } from "viem";
import { DnsCheckRepository } from "../repositories/DnsCheckRepository";
import { MintRepository } from "../repositories/MintRepository";

export const mintRoutes = new Elysia({ prefix: "/mint" })
    .use(adminWalletContext)
    .use(nextSessionContext)
    .decorate(({ adminWalletsRepository, ...decorators }) => ({
        dnsCheckRepository: new DnsCheckRepository(),
        mintRepository: new MintRepository(adminWalletsRepository),
        adminWalletsRepository,
        ...decorators,
    }))
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
            isAuthenticated: "business",
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
            query: { domain },
            businessSession,
        }) => {
            if (!businessSession) {
                return { isRecordSet: false, isAlreadyMinted: false };
            }
            // Normalise the domain
            const normalisedDomain =
                dnsCheckRepository.getNormalizedDomain(domain);
            // Check if the dns txt is set
            const isRecordSet = await dnsCheckRepository.isDnsTxtRecordSet({
                domain: normalisedDomain,
                owner: businessSession.wallet,
            });
            // Check if the product is already minted
            const isAlreadyMinted = await mintRepository.isExistingProduct(
                mintRepository.precomputeProductId(normalisedDomain)
            );
            return { isRecordSet, isAlreadyMinted };
        },
        {
            isAuthenticated: "business",
            query: t.Object({
                domain: t.String(),
            }),
            response: t.Object({
                isRecordSet: t.Boolean(),
                isAlreadyMinted: t.Boolean(),
            }),
        }
    )
    .put(
        "",
        async ({
            businessSession,
            body: { name, domain, productTypes },
            error,
            mintRepository,
            dnsCheckRepository,
        }) => {
            // Ensure the session matches
            if (!businessSession) {
                return error(401, "Invalid session");
            }
            // Normalise the domain
            const normalisedDomain =
                dnsCheckRepository.getNormalizedDomain(domain);
            // Check if the dns txt is set
            const isRecordSet = await dnsCheckRepository.isDnsTxtRecordSet({
                domain: normalisedDomain,
                owner: businessSession.wallet,
            });
            if (!isRecordSet) {
                return error(400, "The DNS txt record is not set");
            }

            // Mint a product
            try {
                const { mintTxHash, productId } =
                    await mintRepository.mintProduct({
                        name,
                        domain: normalisedDomain,
                        productTypes,
                        owner: businessSession.wallet,
                    });

                return { txHash: mintTxHash, productId: toHex(productId) };
            } catch (e) {
                return error(400, (e as Error)?.message ?? "An error occurred");
            }
        },
        {
            isAuthenticated: "business",
            body: t.Object({
                name: t.String(),
                domain: t.String(),
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
                }),
            },
        }
    );
