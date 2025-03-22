import type {
    DisplayEmbededWalletParamsType,
    ModalRpcMetadata,
    ModalRpcStepsInput,
    ModalStepMetadata,
} from "@frak-labs/core-sdk";
import type { UIRequest } from "../providers/ListenerUiProvider";

// Regex replacing {REWARD} with {{ estimatedReward }}
const REWARD_REGEX = /{REWARD}/g;
const REWARD_REGEX_REPLACE = "{{ estimatedReward }}";
const replaceReward = (text: string) =>
    text.replace(REWARD_REGEX, REWARD_REGEX_REPLACE);

/**
 * Map legacy modal metadata to i18n resources
 */
export function mapDeprecatedModalMetadata(request?: UIRequest) {
    if (request?.type === "embeded") {
        return mapEmbeddedModalMetadata(request.params);
    }
    if (request?.type === "modal") {
        return mapModalMetadata(request.steps, request.metadata);
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
function mapModalMetadata(
    request: ModalRpcStepsInput,
    metadata?: ModalRpcMetadata
) {
    const resultMap = new Map<string, string>();

    // Add the dismissed action text if present
    if (metadata?.dismissActionTxt) {
        resultMap.set(
            "sdk.modal.dismiss.primaryAction",
            metadata.dismissActionTxt
        );
        resultMap.set(
            "sdk.modal.dismiss.primaryAction_sharing",
            metadata.dismissActionTxt
        );
        resultMap.set(
            "sdk.modal.dismiss.primaryAction_reward",
            metadata.dismissActionTxt
        );
    }

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
        map.set(`sdk.modal.${key}.title_sharing`, title);
        map.set(`sdk.modal.${key}.title_reward`, title);
    }
    if (description) {
        map.set(`sdk.modal.${key}.description`, replaceReward(description));
        map.set(
            `sdk.modal.${key}.description_sharing`,
            replaceReward(description)
        );
        map.set(
            `sdk.modal.${key}.description_reward`,
            replaceReward(description)
        );
    }
    if (primaryActionText) {
        map.set(`sdk.modal.${key}.primaryAction`, primaryActionText);
        map.set(`sdk.modal.${key}.primaryAction_sharing`, primaryActionText);
        map.set(`sdk.modal.${key}.primaryAction_reward`, primaryActionText);
    }
    if (secondaryActionText) {
        map.set(`sdk.modal.${key}.secondaryAction`, secondaryActionText);
        map.set(
            `sdk.modal.${key}.secondaryAction_sharing`,
            secondaryActionText
        );
        map.set(`sdk.modal.${key}.secondaryAction_reward`, secondaryActionText);
    }
}

// todo: msg pack stuff: https://github.com/nlohmann/json/discussions/2581 - https://jsonjoy.com/blog/json-codec-benchmarks
