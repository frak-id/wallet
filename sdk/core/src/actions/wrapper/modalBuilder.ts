import type {
    DisplayModalParamsType,
    FinalActionType,
    FinalModalStepType,
    FrakClient,
    LoginModalStepType,
    ModalRpcMetadata,
    ModalRpcStepsResultType,
    ModalStepTypes,
    OpenInteractionSessionModalStepType,
    SendTransactionModalStepType,
} from "../../types";
import { displayModal } from "../displayModal";

/**
 * Represent the type of the modal step builder
 */
export type ModalStepBuilder<
    Steps extends ModalStepTypes[] = ModalStepTypes[],
> = {
    /**
     * The current modal params
     */
    params: DisplayModalParamsType<Steps>;
    /**
     * Add a send transaction step to the modal
     */
    sendTx: (
        options: SendTransactionModalStepType["params"]
    ) => ModalStepBuilder<[...Steps, SendTransactionModalStepType]>;
    /**
     * Add a final step of type reward to the modal
     */
    reward: (
        options?: Omit<FinalModalStepType["params"], "action">
    ) => ModalStepBuilder<[...Steps, FinalModalStepType]>;
    /**
     * Add a final step of type sharing to the modal
     */
    sharing: (
        sharingOptions?: Extract<
            FinalActionType,
            { key: "sharing" }
        >["options"],
        options?: Omit<FinalModalStepType["params"], "action">
    ) => ModalStepBuilder<[...Steps, FinalModalStepType]>;
    /**
     * Display the modal
     */
    display: () => Promise<ModalRpcStepsResultType<Steps>>;
};

/**
 * Represent the output type of the modal builder
 */
export type ModalBuilder = ModalStepBuilder<
    [LoginModalStepType, OpenInteractionSessionModalStepType]
>;

/**
 * Helper to craft Frak modal, and share a base initial config
 * @param client - The current Frak Client
 * @param args
 * @param args.metadata - Common modal metadata (customisation, language etc)
 * @param args.login - Login step parameters
 * @param args.openSession - Open session step parameters
 *
 * @description This function will create a modal builder with the provided metadata, login and open session parameters.
 *
 * @example
 * Here is an example of how to use the `modalBuilder` to create and display a sharing modal:
 *
 * ```js
 * // Create the modal builder
 * const modalBuilder = window.FrakSDK.modalBuilder(frakClient, baseModalConfig);
 *
 * // Configure the information to be shared via the sharing link
 * const sharingConfig = {
 *   popupTitle: "Share this with your friends",
 *   text: "Discover our product!",
 *   link: window.location.href,
 * };
 *
 * // Display the sharing modal
 * function modalShare() {
 *   modalBuilder.sharing(sharingConfig).display();
 * }
 * ```
 *
 * @see {@link ModalStepTypes} for more info about each modal step types and their parameters
 * @see {@link ModalRpcMetadata} for more info about the metadata that can be passed to the modal
 * @see {@link ModalRpcStepsResultType} for more info about the result of each modal steps
 * @see {@link displayModal} for more info about how the modal is displayed
 */
export function modalBuilder(
    client: FrakClient,
    {
        metadata,
        login,
        openSession,
    }: {
        metadata?: ModalRpcMetadata;
        login?: LoginModalStepType["params"];
        openSession?: OpenInteractionSessionModalStepType["params"];
    }
): ModalBuilder {
    // Build the initial modal params
    const baseParams: DisplayModalParamsType<
        [LoginModalStepType, OpenInteractionSessionModalStepType]
    > = {
        steps: {
            login: login ?? {},
            openSession: openSession ?? {},
        },
        metadata,
    };

    // Return the step builder
    return modalStepsBuilder(client, baseParams);
}

/**
 * Modal step builder, allowing to add new steps to the modal, and to build and display it
 */
function modalStepsBuilder<CurrentSteps extends ModalStepTypes[]>(
    client: FrakClient,
    params: DisplayModalParamsType<CurrentSteps>
): ModalStepBuilder<CurrentSteps> {
    // Function add the send tx step
    function sendTx(options: SendTransactionModalStepType["params"]) {
        return modalStepsBuilder<
            [...CurrentSteps, SendTransactionModalStepType]
        >(client, {
            ...params,
            steps: {
                ...params.steps,
                sendTransaction: options,
            },
        } as DisplayModalParamsType<
            [...CurrentSteps, SendTransactionModalStepType]
        >);
    }

    // Function to add a reward step at the end
    function reward(options?: Omit<FinalModalStepType["params"], "action">) {
        return modalStepsBuilder<[...CurrentSteps, FinalModalStepType]>(
            client,
            {
                ...params,
                steps: {
                    ...params.steps,
                    final: {
                        ...options,
                        action: { key: "reward" },
                    },
                },
            } as DisplayModalParamsType<[...CurrentSteps, FinalModalStepType]>
        );
    }

    // Function to add sharing step at the end
    function sharing(
        sharingOptions?: Extract<
            FinalActionType,
            { key: "sharing" }
        >["options"],
        options?: Omit<FinalModalStepType["params"], "action">
    ) {
        return modalStepsBuilder<[...CurrentSteps, FinalModalStepType]>(
            client,
            {
                ...params,
                steps: {
                    ...params.steps,
                    final: {
                        ...options,
                        action: { key: "sharing", options: sharingOptions },
                    },
                },
            } as DisplayModalParamsType<[...CurrentSteps, FinalModalStepType]>
        );
    }

    // Function to display it
    async function display() {
        return await displayModal(client, params);
    }

    return {
        // Access current modal params
        params,
        // Function to add new steps
        sendTx,
        reward,
        sharing,
        // Display the modal
        display,
    };
}
