import type {
    ModalRpcMetadata,
    ModalRpcStepsInput,
    ModalStepMetadata,
} from "@frak-labs/core-sdk";
import type { UIRequest } from "@/ui/ListenerUiProvider";

// Replacing `{REWARD}` with `{{ estimatedReward }}`
const replaceReward = (text: string) =>
    text.replace("{REWARD}", "{{ estimatedReward }}");

/**
 * Map legacy modal metadata to i18n resources
 */
export function mapDeprecatedModalMetadata(request?: UIRequest) {
    if (request?.type === "modal") {
        return mapModalMetadata(request.steps, request.metadata);
    }
    return {};
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
