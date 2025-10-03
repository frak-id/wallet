import { adminWalletsRepository, log, viemClient } from "@backend-common";
import { t } from "@backend-utils";
import { addresses, currentStablecoins } from "@frak-labs/app-essentials";
import { mintAbi } from "@frak-labs/app-essentials/blockchain";
import { Elysia } from "elysia";
import { erc20Abi, parseEther, parseUnits } from "viem";
import { readContract, writeContract } from "viem/actions";

/**
 * Funding related routes
 * @param app
 */
export const fundingRoutes = new Elysia({ prefix: "/funding" }).post(
    "/getTestToken",
    async ({ body: { bank, stablecoin } }) => {
        // If a stablecoin is specified, transfer from monerium-dev account
        if (stablecoin) {
            const tokenAddress = currentStablecoins[stablecoin];
            if (!tokenAddress) {
                throw new Error(`Unknown stablecoin: ${stablecoin}`);
            }

            // Check the current balance (if more than 10 ether don't reload it)
            const balance = await readContract(viemClient, {
                abi: erc20Abi,
                address: tokenAddress,
                functionName: "balanceOf",
                args: [bank],
            });
            if (balance > parseEther("50")) {
                return;
            }

            const account = await adminWalletsRepository.getKeySpecificAccount({
                key: "monerium-dev",
            });
            const lock = adminWalletsRepository.getMutexForAccount({
                key: "monerium-dev",
            });

            // Transfer 11 tokens from monerium-dev account
            await lock.runExclusive(async () => {
                const txHash = await writeContract(viemClient, {
                    account,
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: "transfer",
                    args: [bank, parseUnits("11", 18)],
                });
                log.info(
                    { txHash, stablecoin },
                    `Transferred 11 ${stablecoin} to campaign ${bank} with tx hash ${txHash}`
                );
            });
            return;
        }

        // Original mUSD minting logic
        // Check the current campaign balance (if more than 1000 ether don't reload it)
        const balance = await readContract(viemClient, {
            abi: erc20Abi,
            address: addresses.mUSDToken,
            functionName: "balanceOf",
            args: [bank],
        });
        if (balance > parseEther("1000")) {
            return;
        }

        const account = await adminWalletsRepository.getKeySpecificAccount({
            key: "minter",
        });
        const lock = adminWalletsRepository.getMutexForAccount({
            key: "minter",
        });

        // Prepare and send our reload transaction
        await lock.runExclusive(async () => {
            const txHash = await writeContract(viemClient, {
                account,
                address: addresses.mUSDToken,
                abi: [mintAbi],
                functionName: "mint",
                args: [bank, parseEther("1000")],
            });
            log.info(
                { txHash },
                `Reloaded campaign ${bank} with tx hash ${txHash}`
            );
        });
    },
    {
        body: t.Object({
            bank: t.Address(),
            stablecoin: t.Optional(
                t.Union([
                    t.Literal("eure"),
                    t.Literal("gbpe"),
                    t.Literal("usde"),
                    t.Literal("usdc"),
                ])
            ),
        }),
    }
);
