import { adminWalletsRepository, log, viemClient } from "@backend-common";
import {
    campaignBankFactory_deployCampaignBank,
    interactionManager_deployInteractionContract,
    productRegistry_getMetadata,
    productRegistry_mint,
} from "@backend-utils";
import {
    addresses,
    isRunningInProd,
    stringToBytes32,
} from "@frak-labs/app-essentials";
import {
    mintAbi,
    usdcArbitrumAddress,
} from "@frak-labs/app-essentials/blockchain";
import type { ProductTypesKey } from "@frak-labs/core-sdk";
import { productTypesMask } from "@frak-labs/core-sdk";
import type { Mutex } from "async-mutex";
import {
    type Address,
    type Hex,
    type LocalAccount,
    isAddressEqual,
    keccak256,
    parseEther,
    toHex,
    zeroAddress,
} from "viem";
import {
    getTransactionCount,
    readContract,
    simulateContract,
    waitForTransactionReceipt,
    writeContract,
} from "viem/actions";

/**
 * Repository used to mint a product
 */
export class MintRepository {
    /**
     * Precompute the product id from a domain
     * @param domain
     */
    precomputeProductId(domain: string) {
        const normalizedDomain = domain.replace("www.", "");
        return BigInt(keccak256(toHex(normalizedDomain)));
    }

    /**
     * Check if the product already exists
     * @param productId
     */
    async isExistingProduct(productId: bigint) {
        try {
            const existingMetadata = await readContract(viemClient, {
                address: addresses.productRegistry,
                abi: [productRegistry_getMetadata],
                functionName: "getMetadata",
                args: [productId],
            });
            // Return true if the existing metadata exists
            return existingMetadata.productTypes !== 0n;
        } catch {
            return false;
        }
    }

    /**
     * Mint a new product for the given user
     * @param name
     * @param domain
     * @param productTypes
     * @param owner
     */
    async mintProduct({
        name,
        domain,
        productTypes,
        owner,
    }: {
        name: string;
        domain: string;
        productTypes: ProductTypesKey[];
        owner: Address;
    }) {
        const precomputedProductId = this.precomputeProductId(domain);
        // Ensure the product does not already exist
        {
            const alreadyExist =
                await this.isExistingProduct(precomputedProductId);
            if (alreadyExist) {
                throw new Error(
                    `The product ${name} already exists for the domain ${domain}`
                );
            }
        }

        // Get our minter account
        const minter = await adminWalletsRepository.getKeySpecificAccount({
            key: "minter",
        });
        // Prepare the mint tx and send it
        const lock = adminWalletsRepository.getMutexForAccount({
            key: "minter",
        });
        const mintTxHash = await lock.runExclusive(async () => {
            const nonce = await getTransactionCount(viemClient, minter);
            // Perform the mint transaction
            const mintSimulation = await simulateContract(viemClient, {
                account: minter,
                address: addresses.productRegistry,
                abi: [productRegistry_mint],
                functionName: "mint",
                args: [
                    this.encodeProductTypesMask(productTypes),
                    stringToBytes32(name),
                    domain,
                    owner,
                ],
                nonce,
            });
            if (mintSimulation.result !== precomputedProductId) {
                throw new Error("Invalid product id");
            }
            return await writeContract(viemClient, mintSimulation.request);
        });

        // Wait for the mint to be done before proceeding to the transfer
        await waitForTransactionReceipt(viemClient, {
            hash: mintTxHash,
            confirmations: 4,
        });

        // Deploy the matching interaction contract
        const interactionResult = await this.deployInteractionContract({
            productId: precomputedProductId,
            minter,
            lock,
        });

        // Then deploy a mocked usd bank for this product
        let bankResult: { txHash: Hex; bank: Address } | undefined;
        if (isRunningInProd) {
            bankResult = await this.deployUsdcBank({
                productId: precomputedProductId,
                minter,
                lock,
            });
        } else {
            bankResult = await this.deployMockedUsdBank({
                productId: precomputedProductId,
                minter,
                lock,
            });
        }

        return {
            productId: precomputedProductId,
            mintTxHash,
            interactionResult,
            bankResult,
        };
    }

    /**
     * Encode an array of product types keys into a bit mask
     */
    private encodeProductTypesMask(types: ProductTypesKey[]): bigint {
        return types.reduce((acc, type) => acc | productTypesMask[type], 0n);
    }

    private async deployInteractionContract({
        productId,
        minter,
        lock,
    }: { productId: bigint; minter: LocalAccount; lock: Mutex }) {
        try {
            const result = await lock.runExclusive(async () => {
                // Prepare the deployment data
                const { request, result } = await simulateContract(viemClient, {
                    account: minter,
                    address: addresses.productInteractionManager,
                    abi: [interactionManager_deployInteractionContract],
                    functionName: "deployInteractionContract",
                    args: [productId],
                });
                if (!result || isAddressEqual(result, zeroAddress)) {
                    log.warn(
                        { productId, result },
                        "[MintRepository] Failed to simulate the interaction contract deployment"
                    );
                    return;
                }

                // Trigger the deployment
                const txHash = await writeContract(viemClient, request);
                log.debug(
                    { productId, txHash },
                    "[MintRepository] Deployed interaction contract"
                );
                return { txHash, interactionContract: result };
            });
            if (!result) return;
            // Ensure it's included before proceeding
            await waitForTransactionReceipt(viemClient, {
                hash: result.txHash,
                confirmations: 1,
            });
            // And return everything
            return result;
        } catch (error) {
            log.warn(
                { productId, error },
                "[MintRepository] Failed to deploy the interaction contract"
            );
        }
    }

    /**
     * Automatically deploy a mocked usd bank for the given product
     * @param productId
     * @param minter
     * @private
     */
    private async deployMockedUsdBank({
        productId,
        minter,
        lock,
    }: { productId: bigint; minter: LocalAccount; lock: Mutex }) {
        try {
            return await lock.runExclusive(async () => {
                // Get the current nonce
                const nonce = await getTransactionCount(viemClient, minter);

                // Prepare the deployment data
                const { request, result } = await simulateContract(viemClient, {
                    account: minter,
                    abi: [campaignBankFactory_deployCampaignBank],
                    address: addresses.campaignBankFactory,
                    functionName: "deployCampaignBank",
                    args: [productId, addresses.mUSDToken],
                    nonce,
                });
                if (!result || isAddressEqual(result, zeroAddress)) {
                    log.warn(
                        { productId, result },
                        "[MintRepository] Failed to simulate the mocked usd bank deployment"
                    );
                    return;
                }

                // Trigger the deployment
                const txHash = await writeContract(viemClient, request);
                log.debug(
                    { productId, txHash },
                    "[MintRepository] Deployed mocked usd bank"
                );

                // Then mint a few test tokens to this bank
                await writeContract(viemClient, {
                    account: minter,
                    address: addresses.mUSDToken,
                    abi: [mintAbi],
                    functionName: "mint",
                    args: [result, parseEther("500")],
                    nonce: nonce + 1,
                });

                // Then return the hash + contract
                return { txHash, bank: result };
            });
        } catch (error) {
            log.warn(
                { productId, error },
                "[MintRepository] Failed to deploy the mocked usd bank"
            );
        }
    }

    /**
     * Automatically deploy a mocked usd bank for the given product
     * @param productId
     * @param minter
     * @param lock
     * @private
     */
    private async deployUsdcBank({
        productId,
        minter,
        lock,
    }: { productId: bigint; minter: LocalAccount; lock: Mutex }) {
        try {
            return await lock.runExclusive(async () => {
                // Prepare the deployment data
                const { request, result } = await simulateContract(viemClient, {
                    account: minter,
                    abi: [campaignBankFactory_deployCampaignBank],
                    address: addresses.campaignBankFactory,
                    functionName: "deployCampaignBank",
                    args: [productId, usdcArbitrumAddress],
                });
                if (!result || isAddressEqual(result, zeroAddress)) {
                    log.warn(
                        { productId, result },
                        "[MintRepository] Failed to simulate the usdc bank deployment"
                    );
                    return;
                }

                // Trigger the deployment
                const txHash = await writeContract(viemClient, request);
                log.debug(
                    { productId, txHash },
                    "[MintRepository] Deployed usdc bank"
                );
                // Then return the hash + contract
                return { txHash, bank: result };
            });
        } catch (error) {
            log.warn(
                { productId, error },
                "[MintRepository] Failed to deploy the usdc bank"
            );
        }
    }
}
