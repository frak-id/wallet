import type {
    DisplayModalParamsType,
    FinalActionType,
    FinalModalStepType,
    LoginModalStepType,
    ModalRpcMetadata,
    ModalRpcStepsResultType,
    ModalStepTypes,
    NexusClient,
    OpenInteractionSessionModalStepType,
    SendTransactionModalStepType,
} from "../../types";
import { displayModal } from "../displayModal";

/**
 * Simple modal builder params builder
 * @param client
 * @param metadata
 * @param login
 * @param openSession
 */
export function modalBuilder(
    client: NexusClient,
    {
        metadata,
        login,
        openSession,
    }: {
        metadata: ModalRpcMetadata;
        login?: LoginModalStepType["params"];
        openSession?: OpenInteractionSessionModalStepType["params"];
    }
): ModalStepBuilder<[LoginModalStepType, OpenInteractionSessionModalStepType]> {
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
 * Represent the type of the modal step builder
 */
type ModalStepBuilder<Steps extends ModalStepTypes[]> = {
    params: DisplayModalParamsType<Steps>;
    sendTx: (
        options: SendTransactionModalStepType["params"]
    ) => ModalStepBuilder<[...Steps, SendTransactionModalStepType]>;
    reward: (
        options?: Omit<FinalModalStepType["params"], "action">
    ) => ModalStepBuilder<[...Steps, FinalModalStepType]>;
    sharing: (
        sharingOptions?: Extract<
            FinalActionType,
            { key: "sharing" }
        >["options"],
        options?: Omit<FinalModalStepType["params"], "action">
    ) => ModalStepBuilder<[...Steps, FinalModalStepType]>;
    display: () => Promise<ModalRpcStepsResultType<Steps>>;
};

/**
 * Build builder helping to add steps to the modal
 * @param client
 * @param params
 */
function modalStepsBuilder<CurrentSteps extends ModalStepTypes[]>(
    client: NexusClient,
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
