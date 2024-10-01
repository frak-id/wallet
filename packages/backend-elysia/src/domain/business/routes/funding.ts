import { blockchainContext, log } from "@backend-common";
import { t } from "@backend-utils";
import { addresses } from "@frak-labs/app-essentials";
import { Mutex } from "async-mutex";
import { Elysia } from "elysia";
import { Config } from "sst/node/config";
import { type Hex, erc20Abi, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readContract, writeContract } from "viem/actions";

/**
 * Funding related routes
 * @param app
 */
export const fundingRoutes = new Elysia({ prefix: "/funding" })
    .use(blockchainContext)
    .decorate({
        fundingReloadMutex: new Mutex(),
    })
    .post(
        "/getTestToken",
        async ({ body: { bank }, client, fundingReloadMutex }) => {
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

            // Prepare and send our reload transaction
            await fundingReloadMutex.runExclusive(async () => {
                const executorAccount = privateKeyToAccount(
                    Config.AIRDROP_PRIVATE_KEY as Hex
                );
                const txHash = await writeContract(client, {
                    account: executorAccount,
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

const mintAbi = {
    type: "function",
    inputs: [
        { name: "_to", internalType: "address", type: "address" },
        { name: "_amount", internalType: "uint256", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
} as const;
