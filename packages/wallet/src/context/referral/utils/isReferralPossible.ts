import { addresses } from "@/context/common/blockchain/addresses";
import { frakChainPocClient } from "@/context/common/blockchain/provider";
import { nexusDiscoverCampaignAbi } from "@/context/referral/abi/campaign-abis";
import { type Address, type Hex, isAddressEqual, zeroAddress } from "viem";
import { readContract } from "viem/actions";

/**
 * Check if a referral is possible
 * @param user
 * @param referrer
 * @param tree
 */
export async function isReferralPossible({
    user,
    referrer,
    tree,
}: { user: Address; referrer: Address; tree: Hex }) {
    // Ensure we got everything
    if (!(user && referrer)) {
        return false;
    }

    // Ensure the referrer is not the user, and none address is the zero one
    if (
        isAddressEqual(user, referrer) ||
        isAddressEqual(referrer, zeroAddress) ||
        isAddressEqual(user, zeroAddress)
    ) {
        return false;
    }

    // Check if user already referred on this content
    const currentReferrer = await readContract(frakChainPocClient, {
        address: addresses.nexusDiscoverCampaign,
        abi: nexusDiscoverCampaignAbi,
        functionName: "getReferrer",
        args: [tree, user],
    });

    // If the user is already referred, do nothing
    return isAddressEqual(currentReferrer, zeroAddress);
}
