import type {
    DisplayEmbededWalletParamsType,
    ModalRpcStepsInput,
    ModalStepMetadata,
} from "@frak-labs/core-sdk";
import type { UIRequest } from "../providers/ListenerUiProvider";

/**
 * Map legacy modal metadata to i18n ressources
 */
export function mapDeprecatedModalMetadata(request?: UIRequest) {
    if (request?.type === "embeded") {
        return mapEmbeddedModalMetadata(request.params);
    }
    if (request?.type === "modal") {
        return mapModalMetadata(request.steps);
    }
    return {};
}

/**
 * Map the embedded modal metadata to i18n resources
 */
function mapEmbeddedModalMetadata(request: DisplayEmbededWalletParamsType) {
    const resultMap = new Map<string, string>();
    if (!request.loggedIn || !request.loggedOut) {
        return {};
    }

    // Add the sharing translations
    const loggedInAction = request.loggedIn.action;
    if (loggedInAction?.key === "sharing") {
        const { popupTitle, text } = loggedInAction.options ?? {};
        if (popupTitle) {
            resultMap.set("sharing.title", popupTitle);
        }
        if (text) {
            resultMap.set("sharing.text", text);
        }
    }

    // Add the logged out translations
    const { text, buttonText } = request.loggedOut.metadata ?? {};
    if (text) {
        resultMap.set("sdk.wallet.login.text", text);
    }
    if (buttonText) {
        resultMap.set("sdk.wallet.login.primaryAction", buttonText);
    }

    return Object.fromEntries(resultMap);
}

/**
 * Map the modal metadata to i18n resources
 */
function mapModalMetadata(request: ModalRpcStepsInput) {
    const resultMap = new Map<string, string>();

    // Iterate over each steps
    for (const [key, step] of Object.entries(request)) {
        // Add the metadata to the map
        addMetadataToMap(resultMap, key, step.metadata);

        // If we got dismissed metadata, add it to the map
        if ("dismissedMetadata" in step && step.dismissedMetadata) {
            addMetadataToMap(
                resultMap,
                `${key}.dismissed`,
                step.dismissedMetadata
            );
        }

        // If that's a sharing step, add sharing metadata's
        if (
            key === "final" &&
            "action" in step &&
            step.action.key === "sharing"
        ) {
            const { popupTitle, text } = step.action.options ?? {};
            if (popupTitle) {
                resultMap.set("sharing.title", popupTitle);
            }
            if (text) {
                resultMap.set("sharing.text", text);
            }
        }
    }

    return Object.fromEntries(resultMap);
}

/**
 * Add the metadata to the map
 */
function addMetadataToMap(
    map: Map<string, string>,
    key: string,
    metadata: ModalStepMetadata["metadata"]
) {
    if (!metadata) {
        return;
    }
    const { title, description, primaryActionText, secondaryActionText } =
        metadata;

    if (title) {
        map.set(`sdk.modal.${key}.title`, title);
    }
    if (description) {
        map.set(`sdk.modal.${key}.description`, description);
    }
    if (primaryActionText) {
        map.set(`sdk.modal.${key}.primaryAction`, primaryActionText);
    }
    if (secondaryActionText) {
        map.set(`sdk.modal.${key}.secondaryAction`, secondaryActionText);
    }
}

// todo: on each key we should replace the {REWARD} placeholder with the {{ estimatedReward }}
