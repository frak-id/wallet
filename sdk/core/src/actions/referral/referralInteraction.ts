import type { Hex } from "viem";
import type {
    DisplayModalParamsType,
    FrakClient,
    ModalStepTypes,
} from "../../types";
import { FrakContextManager } from "../../utils";
import { watchWalletStatus } from "../index";
import {
    type ProcessReferralOptions,
    processReferral,
} from "./processReferral";

export async function referralInteraction(
    client: FrakClient,
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
    const currentWalletStatus = await watchWalletStatus(client);

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
