import { useCallback, useEffect, useState } from "preact/hooks";
import { getModalBuilderSteps, onClientReady } from "../utils";

/**
 * The props type for {@link ButtonShare}.
 * @inline
 */
type ButtonShareProps = {
    /** Text to display on the button */
    text: string;
    /** Classname to apply to the button */
    classname?: string;
};

/**
 * Open the share modal
 *
 * @description
 * This function will open the share modal with the configuration provided in the `window.FrakSetup.modalShareConfig` object.
 */
function modalShare() {
    const modalBuilderSteps = getModalBuilderSteps();

    if (!modalBuilderSteps) {
        console.error("modalBuilderSteps not found");
        return;
    }

    modalBuilderSteps
        .sharing(window.FrakSetup?.modalShareConfig ?? {})
        .display();
}

/**
 * Button to share the current page
 *
 * @param args
 * @param args.text - Text to display on the button
 * @param args.classname - Classname to apply to the button
 * @returns The share button with `<button>` tag
 *
 * @group components
 *
 * @example
 * Basic usage:
 * ```html
 * <frak-button-share></frak-button-share>
 * ```
 *
 * @example
 * Using a custom text:
 * ```html
 * <frak-button-share text="Share and earn!"></frak-button-share>
 * ```
 *
 * @example
 * Using a custom class:
 * ```html
 * <frak-button-share classname="my-custom-class my-custom-class2"></frak-button-share>
 * ```
 *
 * @see {@link @frak-labs/core-sdk!actions.modalBuilder | `modalBuilder()`} for more info about the underlying action
 */
export function ButtonShare({
    text = "Share and earn!",
    classname = "",
}: ButtonShareProps) {
    const [disabled, setDisabled] = useState(true);

    const handleClientReady = useCallback(() => {
        setDisabled(false);
    }, []);

    useEffect(() => {
        onClientReady("add", handleClientReady);
        return () => onClientReady("remove", handleClientReady);
    }, [handleClientReady]);

    return (
        <button
            type={"button"}
            class={classname}
            disabled={disabled}
            onClick={modalShare}
        >
            {text}
        </button>
    );
}
