import type { FrakClient } from "../../types";
import { FrakContextManager } from "../../utils";
import { watchWalletStatus } from "../index";
import {
    type ProcessReferralOptions,
    processReferral,
} from "./processReferral";

/**
 * Function used to handle referral interactions
 * @param client - The current Frak Client
 * @param args
 * @param args.options - Some options for the referral interaction
 *
 * @returns  A promise with the resulting referral state, or undefined in case of an error
 *
 * @description This function will automatically handle the referral interaction process
 *
 * @see {@link processReferral} for more details on the automatic referral handling process
 */
export async function referralInteraction(
    client: FrakClient,
    {
        options,
    }: {
        options?: ProcessReferralOptions;
    } = {}
) {
    // Get the current frak context
    const frakContext = FrakContextManager.parse({
        url: window.location.href,
    });

    // Get the current wallet status
    const currentWalletStatus = await watchWalletStatus(client);

    try {
        return processReferral(client, {
            walletStatus: currentWalletStatus,
            frakContext,
            options,
        });
    } catch (error) {
        console.warn("Error processing referral", { error });
    }
    return;
}
