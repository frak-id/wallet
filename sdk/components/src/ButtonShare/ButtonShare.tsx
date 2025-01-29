import {
    DebugInfoGatherer,
    FrakRpcError,
    type FullInteractionTypesKey,
    RpcErrorCodes,
} from "@frak-labs/core-sdk";
import { displayEmbededWallet } from "@frak-labs/core-sdk/actions";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import {
    getCurrentReward,
    getModalBuilderSteps,
    onClientReady,
} from "../utils";

/**
 * The props type for {@link ButtonShare}.
 * @inline
 */
export type ButtonShareProps = {
    /**
     * Text to display on the button
     *  - To specify where the reward should be displayed, use the placeholder `{REWARD}`, e.g. `Share and earn up to {REWARD}!`
     * @defaultValue `"Share and earn!"`
     */
    text?: string;
    /**
     * Classname to apply to the button
     */
    classname?: string;
    /**
     * Do we display the reward on the share modal?
     * @defaultValue `false`
     */
    useReward?: boolean;
    /**
     * Fallback text if the reward isn't found
     */
    noRewardText?: string;
    /**
     * Target interaction behind this sharing action (will be used to get the right reward to display)
     */
    targetInteraction?: FullInteractionTypesKey;
    /**
     * Do we display the wallet modal instead of the share modal?
     * @defaultValue `false`
     */
    showWallet?: boolean;
};

/**
 * Open the share modal
 *
 * @description
 * This function will open the share modal with the configuration provided in the `window.FrakSetup.modalShareConfig` object.
 */
async function modalShare(targetInteraction?: FullInteractionTypesKey) {
    const modalBuilderSteps = getModalBuilderSteps();

    if (!modalBuilderSteps) {
        throw new Error("modalBuilderSteps not found");
    }

    await modalBuilderSteps
        .sharing(window.FrakSetup?.modalShareConfig ?? {})
        .display((metadata) => ({
            ...metadata,
            targetInteraction,
        }));
}

/**
 * Open the embeded wallet modal
 *
 * @description
 * This function will open the wallet modal with the configuration provided in the `window.FrakSetup.modalWalletConfig` object.
 */
async function modalEmbededWallet() {
    if (!window.FrakSetup?.client) {
        throw new Error("Frak client not found");
    }
    await displayEmbededWallet(
        window.FrakSetup.client,
        window.FrakSetup?.modalWalletConfig ?? {}
    );
}

/**
 * Button to share the current page
 *
 * @param args
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
 * <frak-button-share classname="button button-primary"></frak-button-share>
 * ```
 *
 * @example
 * Using reward information and fallback text:
 * ```html
 * <frak-button-share use-reward text="Share and earn up to {REWARD}!" no-reward-text="Share and earn!"></frak-button-share>
 * ```
 *
 * @example
 * Using reward information for specific reward and fallback text:
 * ```html
 * <frak-button-share use-reward text="Share and earn up to {REWARD}!" no-reward-text="Share and earn!" target-interaction="retail.customerMeeting"></frak-button-share>
 * ```
 *
 * @see {@link @frak-labs/core-sdk!actions.modalBuilder | `modalBuilder()`} for more info about the modal display
 * @see {@link @frak-labs/core-sdk!actions.getProductInformation | `getProductInformation()`} for more info about the estimated reward fetching
 */
export function ButtonShare({
    text = "Share and earn!",
    classname = "",
    useReward: rawUseReward,
    noRewardText,
    targetInteraction,
    showWallet: rawShowWallet,
}: ButtonShareProps) {
    const useReward = useMemo(() => rawUseReward !== undefined, [rawUseReward]);
    const showWallet = useMemo(
        () => rawShowWallet !== undefined,
        [rawShowWallet]
    );

    const [debugInfo, setDebugInfo] = useState<string | undefined>(undefined);
    const [reward, setReward] = useState<string | undefined>(undefined);
    const [isError, setIsError] = useState(false);

    /**
     * Once the client is ready, enable the button and fetch the reward if needed
     */
    const handleClientReady = useCallback(() => {
        if (!useReward) return;

        // Find the estimated reward
        getCurrentReward(targetInteraction).then((reward) => {
            if (!reward) return;
            setReward(`${reward}€`);
        });
    }, [useReward, targetInteraction]);

    /**
     * Setup our client listener
     */
    useEffect(() => {
        onClientReady("add", handleClientReady);
        return () => onClientReady("remove", handleClientReady);
    }, [handleClientReady]);

    /**
     * Compute the text we will display
     */
    const btnText = useMemo(() => {
        if (!useReward) return text;
        if (!reward) return noRewardText ?? text.replace("{REWARD}", "");

        // Here if we have a reward
        // Check if the text contain a REWARD placeholder, otherwise, put the reward at the end
        return text.includes("{REWARD}")
            ? text.replace("{REWARD}", reward)
            : `${text} ${reward}`;
    }, [useReward, text, noRewardText, reward]);

    /**
     * The action when the button is clicked
     */
    const onClick = useCallback(async () => {
        // If no client present, set in error state
        if (!window.FrakSetup?.client) {
            console.error("Frak client not found");
            setDebugInfo(
                DebugInfoGatherer.empty().formatDebugInfo(
                    "Frak client not found"
                )
            );
            setIsError(true);
            return;
        }

        // Try to open the embeded wallet or the sharing modal
        try {
            if (showWallet) {
                await modalEmbededWallet();
            } else {
                await modalShare(targetInteraction);
            }
        } catch (e) {
            // Ignore the error if the user aborted the modal
            if (
                e instanceof FrakRpcError &&
                e.code === RpcErrorCodes.clientAborted
            ) {
                console.debug("User aborted the modal");
                return;
            }

            const debugInfo =
                window.FrakSetup.client.debugInfo.formatDebugInfo(e);
            setDebugInfo(debugInfo);
            setIsError(true);

            console.error("Error while opening the modal", e);
            return;
        }
    }, [showWallet, targetInteraction]);

    return (
        <>
            <button type={"button"} class={classname} onClick={onClick}>
                {btnText}
            </button>
            {isError && (
                <>
                    <ErrorMessage debugInfo={debugInfo} />
                    <ToggleMessage debugInfo={debugInfo} />
                </>
            )}
        </>
    );
}

function ErrorMessage({ debugInfo }: { debugInfo?: string }) {
    const { copied, copy } = useCopyToClipboard();

    return (
        <span style={{ display: "block" }}>
            <b>Oups ! Nous avons rencontré un petit problème</b>
            <br />
            Impossible d'ouvrir le menu de partage pour le moment. Si le
            problème persiste, copiez les informations ci-dessous et collez-les
            dans votre mail à{" "}
            <a href="mailto:help@frak-labs.com">help@frak-labs.com</a>
            <br />
            Merci pour votre retour, nous traitons votre demande dans les plus
            brefs délais.
            <br />
            <button
                type={"button"}
                style={{
                    padding: "5px 10px",
                    background: "#6e7680",
                    color: "#fff",
                }}
                onClick={() => copy(debugInfo ?? "")}
            >
                {copied
                    ? "Copié ! Vous pouvez le coller dans votre mail"
                    : "Copier les informations"}
            </button>
        </span>
    );
}

function ToggleMessage({ debugInfo }: { debugInfo?: string }) {
    const [showInfo, setShowInfo] = useState(false);

    return (
        <div>
            <button
                type={"button"}
                style={{
                    margin: "10px 0",
                    padding: "5px 10px",
                    background: "#6e7680",
                    color: "#fff",
                }}
                onClick={() => setShowInfo(!showInfo)}
            >
                Ouvrir les informations
            </button>
            {showInfo && (
                <textarea
                    style={{ display: "block", width: "100%", height: "200px" }}
                >
                    {debugInfo}
                </textarea>
            )}
        </div>
    );
}
