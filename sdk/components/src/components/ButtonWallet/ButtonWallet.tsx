import { useClientReady } from "@/hooks/useClientReady";
import { useReward } from "@/hooks/useReward";
import { useEffect, useMemo, useRef } from "preact/hooks";
import GiftIcon from "./assets/gift.svg";
import type { ButtonWalletProps } from "./types";
import { openWalletModal } from "./utils";
import "./ButtonWallet.css";

/**
 * Button to open wallet modal
 *
 * @param args
 * @returns The wallet button with `<button>` tag
 *
 * @group components
 *
 * @example
 * Basic usage:
 * ```html
 * <frak-button-wallet></frak-button-wallet>
 * ```
 *
 * @example
 * Using a custom class:
 * ```html
 * <frak-button-wallet classname="button button-primary"></frak-button-wallet>
 * ```
 *
 * @example
 * Using reward information:
 * ```html
 * <frak-button-wallet use-reward></frak-button-wallet>
 * ```
 *
 * @example
 * Using reward information for specific reward:
 * ```html
 * <frak-button-wallet use-reward target-interaction="retail.customerMeeting"></frak-button-wallet>
 * ```
 *
 * @see {@link @frak-labs/core-sdk!actions.modalBuilder | `modalBuilder()`} for more info about the modal display
 * @see {@link @frak-labs/core-sdk!actions.getProductInformation | `getProductInformation()`} for more info about the estimated reward fetching
 */
export function ButtonWallet({
    classname = "",
    useReward: rawUseReward,
    targetInteraction,
}: ButtonWalletProps) {
    const shouldUseReward = useMemo(
        () => rawUseReward !== undefined,
        [rawUseReward]
    );
    const buttonRef = useRef<HTMLButtonElement>(null);
    const { isClientReady } = useClientReady();
    const { reward } = useReward(
        shouldUseReward && isClientReady,
        targetInteraction
    );

    /**
     * Setup the position of the button
     */
    useEffect(() => {
        const position =
            window.FrakSetup?.modalWalletConfig?.metadata?.position;
        buttonRef.current?.parentElement?.classList.add(position ?? "right");
    }, []);

    return (
        <button
            ref={buttonRef}
            type={"button"}
            class={classname}
            disabled={!isClientReady}
            onClick={openWalletModal}
        >
            <GiftIcon />
            {reward && <span>{reward}</span>}
        </button>
    );
}
