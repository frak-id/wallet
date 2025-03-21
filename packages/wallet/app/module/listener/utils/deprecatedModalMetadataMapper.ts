import type {
    DisplayEmbededWalletParamsType,
    ModalRpcStepsInput,
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
            resultMap.set("sharing.default.title", popupTitle);
        }
        if (text) {
            resultMap.set("sharing.default.text", text);
        }
    }

    // Add the logged out translations
    const { text, buttonText } = request.loggedOut.metadata ?? {};
    if (text) {
        resultMap.set("sdk.wallet.login.default.text", text);
    }
    if (buttonText) {
        resultMap.set("sdk.wallet.login.default.primaryAction", buttonText);
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
        if (!step.metadata) {
            continue;
        }

        // Get the step metadata
        const { title, description, primaryActionText, secondaryActionText } =
            step.metadata;

        // Add the translations
        if (title) {
            resultMap.set(`sdk.modal.${key}.default.title`, title);
            resultMap.set(`sdk.modal.${key}.default.title_reward`, title);
            resultMap.set(`sdk.modal.${key}.default.title_sharing`, title);
        }
        if (description) {
            resultMap.set(`sdk.modal.${key}.default.description`, description);
            resultMap.set(
                `sdk.modal.${key}.default.description_reward`,
                description
            );
            resultMap.set(
                `sdk.modal.${key}.default.description_sharing`,
                description
            );
        }
        if (primaryActionText) {
            resultMap.set(
                `sdk.modal.${key}.default.primaryAction`,
                primaryActionText
            );
        }
        if (secondaryActionText) {
            resultMap.set(
                `sdk.modal.${key}.default.secondaryAction`,
                secondaryActionText
            );
        }

        // todo: should also support final dismissed metadata
    }

    return Object.fromEntries(resultMap);
}
