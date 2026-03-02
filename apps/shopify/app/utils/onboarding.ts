import { getFrakWebookStatus } from "app/services.server/backendMerchant";
import {
    type FirstProductPublishedReturnType,
    firstProductPublished,
} from "app/services.server/shop";
import {
    doesThemeHasFrakActivated,
    doesThemeHasFrakButton,
    doesThemeHasFrakWalletButton,
    type GetMainThemeIdReturnType,
    getMainThemeId,
} from "app/services.server/theme";
import {
    type GetWebhooksSubscriptionsReturnType,
    getWebhooks,
} from "app/services.server/webhook";
import {
    type GetWebPixelReturnType,
    getWebPixel,
} from "app/services.server/webPixel";
import type { AuthenticatedContext } from "app/types/context";
import { resolveMerchantId } from "../services.server/merchant";

export type OnboardingStepData = {
    webPixel?: GetWebPixelReturnType;
    webhooks?: GetWebhooksSubscriptionsReturnType["edges"];
    isThemeHasFrakActivated?: boolean;
    isThemeHasFrakButton?: boolean;
    theme?: GetMainThemeIdReturnType;
    firstProduct?: FirstProductPublishedReturnType;
    themeWalletButton?: string | null;
    frakWebhook?: {
        setup: boolean;
    };
    merchantId?: string | null;
};

export type StepValidation = {
    [key: number]: (data: OnboardingStepData) => boolean;
};

/**
 * Validation functions for each onboarding step
 */
export const stepValidations: StepValidation = {
    1: (data) => Boolean(data?.merchantId), // Merchant registered in Frak
    2: (data) => Boolean(data?.webPixel?.id), // Web pixel must be created
    3: (data) => Boolean(data?.webhooks?.length), // Webhooks must be set up
    4: (data) => Boolean(data?.frakWebhook?.setup), // Frak webhook must be set up
    5: (data) => Boolean(data?.isThemeHasFrakActivated), // Theme must have Frak activated
    6: (data) => Boolean(data?.isThemeHasFrakButton || data?.themeWalletButton), // Theme must have Frak button or wallet button
};

/**
 * Data fetchers for each onboarding step
 */
export const stepDataFetchers = {
    1: async (context: AuthenticatedContext): Promise<OnboardingStepData> => {
        try {
            const merchantId = await resolveMerchantId(context);
            return { merchantId };
        } catch (e) {
            console.warn("Error resolving merchantId", e);
            return {};
        }
    },
    2: async (context: AuthenticatedContext): Promise<OnboardingStepData> => {
        try {
            const webPixel = await getWebPixel(context);
            return { webPixel };
        } catch (error) {
            console.error("Error fetching web pixel:", error);
            return {};
        }
    },

    3: async (context: AuthenticatedContext): Promise<OnboardingStepData> => {
        try {
            const webhooks = await getWebhooks(context);
            return { webhooks };
        } catch (error) {
            console.error("Error fetching shopify webhooks:", error);
            return {};
        }
    },

    4: async (
        context: AuthenticatedContext,
        request: Request
    ): Promise<OnboardingStepData> => {
        try {
            const merchantId = await resolveMerchantId(context);
            const frakWebhook = await getFrakWebookStatus(context, request);
            return { frakWebhook, merchantId };
        } catch (error) {
            console.error("Error fetching frak webhook:", error);
            return {};
        }
    },

    5: async (context: AuthenticatedContext): Promise<OnboardingStepData> => {
        try {
            const [isThemeHasFrakActivated, theme] = await Promise.all([
                doesThemeHasFrakActivated(context),
                getMainThemeId(context),
            ]);
            return { isThemeHasFrakActivated, theme };
        } catch (error) {
            console.error("Error fetching theme data:", error);
            return {};
        }
    },

    6: async (context: AuthenticatedContext): Promise<OnboardingStepData> => {
        try {
            const [isThemeHasFrakButton, firstProduct, themeWalletButton] =
                await Promise.all([
                    doesThemeHasFrakButton(context),
                    firstProductPublished(context),
                    doesThemeHasFrakWalletButton(context),
                ]);
            return { isThemeHasFrakButton, firstProduct, themeWalletButton };
        } catch (error) {
            console.error("Error fetching button data:", error);
            return {};
        }
    },
};

/**
 * Validates if a specific step is completed based on the provided data
 * @param step - The step number to validate
 * @param data - The onboarding step data
 * @returns boolean indicating if the step is invalid (used for button disabled state)
 */
export function validateStep(step: number, data: OnboardingStepData): boolean {
    const validator = stepValidations[step];
    return validator ? !validator(data) : false;
}

/**
 * Fetches all data needed for comprehensive onboarding validation
 * @param context - The authenticated context
 * @returns Complete onboarding data for all steps
 */
export async function fetchAllOnboardingData(
    context: AuthenticatedContext,
    request: Request
): Promise<OnboardingStepData> {
    try {
        // Fetch all data in parallel for efficiency
        const [
            shopInfoData,
            webPixelData,
            webhookData,
            frakWebhookData,
            themeData,
            buttonData,
        ] = await Promise.all([
            stepDataFetchers[1](context),
            stepDataFetchers[2](context),
            stepDataFetchers[3](context),
            stepDataFetchers[4](context, request),
            stepDataFetchers[5](context),
            stepDataFetchers[6](context),
        ]);
        // Merge all data
        return {
            ...shopInfoData,
            ...webPixelData,
            ...webhookData,
            ...frakWebhookData,
            ...themeData,
            ...buttonData,
        };
    } catch (error) {
        console.error("Error fetching complete onboarding data:", error);
        return {};
    }
}
/**
 * All the critical onboarding steps
 *  - Frak registration
 *  - Web pixel
 *  - Webhooks
 *  - Frak webhook
 *  - Theme activation
 */
const criticalOnboardingSteps = [1, 2, 3, 4, 5];

/**
 * Checks if the entire onboarding process is complete
 * @param data - The complete onboarding data
 * @returns object with completion status and failed steps
 */
export function validateCompleteOnboarding(data: OnboardingStepData): {
    isComplete: boolean;
    failedSteps: number[];
    completedSteps: number[];
    hasMissedCriticalSteps: boolean;
} {
    const failedSteps: number[] = [];
    const completedSteps: number[] = [];

    // Check steps 1-6
    for (let step = 1; step <= 6; step++) {
        const validator = stepValidations[step];
        if (validator) {
            if (validator(data)) {
                completedSteps.push(step);
            } else {
                failedSteps.push(step);
            }
        }
    }

    // Check if any critical steps are missing
    const hasMissedCriticalSteps = criticalOnboardingSteps.some(
        (step) => !completedSteps.includes(step)
    );

    return {
        isComplete: failedSteps.length === 0,
        failedSteps,
        completedSteps,
        hasMissedCriticalSteps,
    };
}

/**
 * Gets a human-readable status message for onboarding completion
 * @param validationResult - Result from validateCompleteOnboarding
 * @returns Status message object
 */
export function getOnboardingStatusMessage(validationResult: {
    isComplete: boolean;
    failedSteps: number[];
    completedSteps: number[];
}): string | null {
    if (validationResult.isComplete) {
        return null;
    }

    const stepNames = {
        1: "Shop Info",
        2: "Web Pixel",
        3: "Shopify Webhooks",
        4: "Frak Webhook",
        5: "Theme Activation",
        6: "Frak Buttons",
    };

    const failedStepNames = validationResult.failedSteps
        .map((step) => stepNames[step as keyof typeof stepNames])
        .filter(Boolean);

    return `Onboarding incomplete. Missing: ${failedStepNames.join(", ")}`;
}
