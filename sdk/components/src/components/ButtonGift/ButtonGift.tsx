import { useClientReady } from "@/hooks/useClientReady";
import { useReward } from "@/hooks/useReward";
import { useMemo } from "preact/hooks";
import { GiftBoxAnimation } from "./components/GiftBoxAnimation";
import type { ButtonGiftProps } from "./types";
import { openWalletModal } from "./utils";

/**
 * Button to open gift modal
 *
 * @param args
 * @returns The gift button with `<button>` tag
 *
 * @group components
 *
 * @example
 * Basic usage:
 * ```html
 * <frak-button-gift></frak-button-gift>
 * ```
 *
 * @example
 * Using a custom class:
 * ```html
 * <frak-button-gift classname="button button-primary"></frak-button-gift>
 * ```
 *
 * @example
 * Using reward information:
 * ```html
 * <frak-button-gift use-reward></frak-button-gift>
 * ```
 *
 * @example
 * Using reward information for specific reward:
 * ```html
 * <frak-button-gift use-reward target-interaction="retail.customerMeeting"></frak-button-gift>
 * ```
 *
 * @see {@link @frak-labs/core-sdk!actions.modalBuilder | `modalBuilder()`} for more info about the modal display
 * @see {@link @frak-labs/core-sdk!actions.getProductInformation | `getProductInformation()`} for more info about the estimated reward fetching
 */
export function ButtonGift({
    useReward: rawUseReward,
    targetInteraction,
}: ButtonGiftProps) {
    const shouldUseReward = useMemo(
        () => rawUseReward !== undefined,
        [rawUseReward]
    );
    const { isClientReady } = useClientReady();
    const { reward } = useReward(
        shouldUseReward && isClientReady,
        targetInteraction
    );

    return (
        <>
            <GiftBoxAnimation onClick={openWalletModal} />
            {reward && <span>{reward}</span>}
        </>
    );
}
