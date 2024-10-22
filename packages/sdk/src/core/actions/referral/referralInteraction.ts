import type { Hex } from "viem";
import { walletStatus } from "../";
import type {
    DisplayModalParamsType,
    ModalStepTypes,
    NexusClient,
} from "../../types";
import { FrakContextManager } from "../../utils";
import {
    type ProcessReferralOptions,
    processReferral,
} from "./processReferral";

export async function referralInteraction(
    client: NexusClient,
    {
        productId,
        modalConfig,
        options,
    }: {
        productId?: Hex;
        modalConfig?: DisplayModalParamsType<ModalStepTypes[]>;
        options?: ProcessReferralOptions;
    } = {}
) {
    // Get the current frak context
    const frakContext = FrakContextManager.parse({
        url: window.location.href,
    });

    // Get the current wallet status
    const currentWalletStatus = await walletStatus(client);

    try {
        return await processReferral(client, {
            walletStatus: currentWalletStatus,
            frakContext,
            modalConfig,
            productId,
            options,
        });
    } catch (error) {
        return error;
    }
}
