import { adminWalletContext, blockchainContext, log } from "@backend-common";
import { t } from "@backend-utils";
import { addresses } from "@frak-labs/app-essentials";
import { mintAbi } from "@frak-labs/app-essentials/blockchain";
import { Elysia } from "elysia";
import { erc20Abi, parseEther } from "viem";
import { readContract, writeContract } from "viem/actions";

/**
 * Funding related routes
 * @param app
 */
export const fundingRoutes = new Elysia({ prefix: "/funding" })
    .use(blockchainContext)
    .use(adminWalletContext)
    .post(
        "/getTestToken",
        async ({ body: { bank }, client, adminWalletsRepository }) => {
            // Check the current campaign balance (if more than 1000 ether don't reload it)
            const balance = await readContract(client, {
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
                const txHash = await writeContract(client, {
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
            }),
        }
    );
