import type { Hex } from "viem";
import { walletStatus } from "../actions";
import type {
    DisplayModalParamsType,
    ModalStepTypes,
    NexusClient,
} from "../types";
import { NexusContextManager } from "../utils";
import { processReferral } from "./processReferral";

export async function referralInteraction(
    client: NexusClient,
    {
        productId,
        modalConfig,
    }: {
        productId?: Hex;
        modalConfig?: DisplayModalParamsType<ModalStepTypes[]>;
    } = {}
) {
    // Get the current nexus context
    const nexusContext = await NexusContextManager.parse({
        url: window.location.href,
    });

    // Get the current wallet status
    const currentWalletStatus = await walletStatus(client);

    try {
        return await processReferral(client, {
            walletStatus: currentWalletStatus,
            nexusContext,
            modalConfig,
            productId,
        });
    } catch (error) {
        return error;
    }
}
