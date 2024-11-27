import { walletSessionContext } from "@backend-common";
import { t } from "@backend-utils";
import {
    productInteractionDiamondAbi,
    referralCampaignAbi,
} from "@frak-labs/app-essentials";
import { Elysia } from "elysia";
import { multicall, readContract } from "viem/actions";
import { walletContext } from "../context";

export const rewardsRoutes = new Elysia({ prefix: "/reward" })
    .use(walletSessionContext)
    .use(walletContext)
    .get(
        "estimated",
        async ({
            query: { productId },
            error,
            client,
            walletSession,
            interactionDiamondRepository,
        }) => {
            if (!walletSession) return error(401, "Unauthorized");

            // Get the current interaction contract
            const interactionContract =
                await interactionDiamondRepository.getDiamondContract(
                    productId
                );
            if (!interactionContract) {
                return null;
            }

            // Get all the linked campaign
            const linkedCampaign = await readContract(client, {
                abi: productInteractionDiamondAbi,
                functionName: "getCampaigns",
                address: interactionContract,
            });
            if (!linkedCampaign.length) {
                return null;
            }

            // Check if each campaigns are active or not
            const isCampaignActives = await multicall(client, {
                contracts: linkedCampaign.map(
                    (campaign) =>
                        ({
                            abi: referralCampaignAbi,
                            address: campaign,
                            functionName: "isActive",
                        }) as const
                ),
                allowFailure: false,
            });

            // If none active early exit
            if (!isCampaignActives.some((isActive) => isActive)) {
                return null;
            }

            // Here is how the triggers are stored
            /*
                /// @dev Representing a reward trigger
    struct RewardTrigger {
        uint192 baseReward;
        uint16 userPercent;
        uint16 deperditionPerLevel;
        uint16 maxCountPerUser;
    }

    /// @dev Representing the reward trigger storage, storage location is at:
    ///     (
    ///         bytes32(uint256(keccak256('frak.campaign.referral.trigger')) - 1) &
    ///         0x00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffff
    ///     ) | _interactionType
    function _trigger(InteractionType _interactionType) private pure returns (RewardTrigger storage storagePtr) {
        assembly {
            storagePtr.slot := or(0x2b590e368f6e51c03042de6eb3d37f464929de3b3f869c37f1eb01ab, _interactionType)
        }
    }
             */

            // todo: Fetch campaigns triggers
            //  todo: need to find contract creation call, decompile bytes args to the abi, and extract triggers to check the associated rewards
            //  todo: Should implement some lru caching, since it will be heavy on rpc calls and is safe to cache for a short time (like 3-5min)

            return {
                eurCumulated: 0,
                rewards: [],
            };
        },
        {
            authenticated: "wallet",
            query: t.Object({
                productId: t.Hex(),
            }),
            response: {
                401: t.String(),
                200: t.Union([
                    t.Object({
                        eurCumulated: t.Number(),
                        rewards: t.Array(
                            t.Object({
                                campaign: t.Address(),
                                trigger: t.String(),
                                token: t.Address(),
                                eur: t.Number(),
                                raw: t.BigInt(),
                            })
                        ),
                    }),
                    t.Null(),
                ]),
            },
        }
    );
