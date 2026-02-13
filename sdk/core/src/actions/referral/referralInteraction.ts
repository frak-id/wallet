import type { DisplayEmbeddedWalletParamsType, FrakClient } from "../../types";
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
 * @param args.modalConfig - The modal configuration to display if the user is not logged in
 * @param args.options - Some options for the referral interaction
 *
 * @returns  A promise with the resulting referral state, or undefined in case of an error
 *
 * @description This function will automatically handle the referral interaction process
 *
 * @see {@link processReferral} for more details on the automatic referral handling process
 * @see {@link @frak-labs/core-sdk!ModalStepTypes} for more details on each modal steps types
 */
export async function referralInteraction(
    client: FrakClient,
    {
        modalConfig,
        options,
    }: {
        modalConfig?: DisplayEmbeddedWalletParamsType;
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
        return await processReferral(client, {
            walletStatus: currentWalletStatus,
            frakContext,
            modalConfig,
            options,
        });
    } catch (error) {
        console.warn("Error processing referral", { error });
    }
    return;
}
