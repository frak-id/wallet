import { addresses, isRunningInProd } from "@frak-labs/app-essentials";
import { getViemClient } from "@frak-labs/nexus-backend/src/blockchain/client";
import { Mutex } from "async-mutex";
import { Elysia, t } from "elysia";
import { Config } from "sst/node/config";
import {
    type Hex,
    encodeFunctionData,
    erc20Abi,
    isAddress,
    parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readContract, sendTransaction } from "viem/actions";
import { blockchainContext } from "../../../common/context";

/**
 * Funding related routes
 * @param app
 */
export const fundingRoutes = new Elysia({ prefix: "funding" })
    .use(blockchainContext())
    .decorate({
        fundingReloadMutex: new Mutex(),
    })
    .post(
        "/freeReload",
        async ({ body: { campaign }, client, fundingReloadMutex }) => {
            // Check if we are in production
            if (isRunningInProd) {
                throw new Error("Not allowed in production");
            }

            // Check if the campaign is a valid address
            if (!isAddress(campaign)) {
                throw new Error("Invalid campaign");
            }

            // Check the current campaign balance (if more than 1000 ether don't reload it)
            const balance = await readContract(client, {
                abi: erc20Abi,
                address: addresses.mUsdToken,
                functionName: "balanceOf",
                args: [campaign],
            });
            if (balance > parseEther("1000")) {
                return;
            }

            // Prepare and send our reload transaction
            await fundingReloadMutex.runExclusive(async () => {
                const executorAccount = privateKeyToAccount(
                    Config.AIRDROP_PRIVATE_KEY as Hex
                );
                const txHash = await sendTransaction(getViemClient(), {
                    account: executorAccount,
                    to: addresses.mUsdToken,
                    data: encodeFunctionData({
                        abi: [mintAbi],
                        functionName: "mint",
                        args: [campaign, parseEther("1000")],
                    }),
                });
                console.log(
                    `Reloaded campaign ${campaign} with tx hash ${txHash}`
                );
            });
        },
        {
            body: t.Object({
                campaign: t.String(),
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
