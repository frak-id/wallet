import { getFrakWebookStatus } from "app/services.server/backendMerchant";
import { log } from "app/services.server/logger";
import { firstProductPublished } from "app/services.server/shop";
import {
    doesThemeHasFrakActivated,
    doesThemeHasFrakBanner,
    doesThemeHasFrakButton,
    getMainThemeId,
} from "app/services.server/theme";
import { getWebhooks } from "app/services.server/webhook";
import { getWebPixel } from "app/services.server/webPixel";
import type { AuthenticatedContext } from "app/types/context";
import { resolveMerchantId } from "../services.server/merchant";
import type { OnboardingStepData } from "./onboarding";

/**
 * Data fetchers for each onboarding step.
 *
 * Server-only: these pull in `app/services.server/*` (Shopify Admin GraphQL +
 * the pino/AsyncLocalStorage logger). They live in a `.server`-suffixed module
 * so they can never leak into the client bundle — importing them from a
 * client-reachable module would ship `node:async_hooks` to the browser and
 * crash hydration.
 */
const stepDataFetchers = {
    1: async (context: AuthenticatedContext): Promise<OnboardingStepData> => {
        try {
            const merchantId = await resolveMerchantId(context);
            return { merchantId };
        } catch (e) {
            log.warn({ err: e }, "onboarding: error resolving merchantId");
            return {};
        }
    },
    2: async (context: AuthenticatedContext): Promise<OnboardingStepData> => {
        try {
            const webPixel = await getWebPixel(context);
            return { webPixel };
        } catch (error) {
            log.error({ err: error }, "onboarding: error fetching web pixel");
            return {};
        }
    },

    3: async (context: AuthenticatedContext): Promise<OnboardingStepData> => {
        try {
            const webhooks = await getWebhooks(context);
            return { webhooks };
        } catch (error) {
            log.error(
                { err: error },
                "onboarding: error fetching shopify webhooks"
            );
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
            log.error(
                { err: error },
                "onboarding: error fetching frak webhook"
            );
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
            log.error({ err: error }, "onboarding: error fetching theme data");
            return {};
        }
    },

    6: async (context: AuthenticatedContext): Promise<OnboardingStepData> => {
        try {
            const [isThemeHasFrakButton, firstProduct] = await Promise.all([
                doesThemeHasFrakButton(context),
                firstProductPublished(context),
            ]);
            return { isThemeHasFrakButton, firstProduct };
        } catch (error) {
            log.error({ err: error }, "onboarding: error fetching button data");
            return {};
        }
    },

    7: async (context: AuthenticatedContext): Promise<OnboardingStepData> => {
        try {
            const isThemeHasFrakBanner = await doesThemeHasFrakBanner(context);
            return { isThemeHasFrakBanner };
        } catch (error) {
            log.error({ err: error }, "onboarding: error fetching banner data");
            return {};
        }
    },
};

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
            bannerData,
        ] = await Promise.all([
            stepDataFetchers[1](context),
            stepDataFetchers[2](context),
            stepDataFetchers[3](context),
            stepDataFetchers[4](context, request),
            stepDataFetchers[5](context),
            stepDataFetchers[6](context),
            stepDataFetchers[7](context),
        ]);
        // Merge all data
        return {
            ...shopInfoData,
            ...webPixelData,
            ...webhookData,
            ...frakWebhookData,
            ...themeData,
            ...buttonData,
            ...bannerData,
        };
    } catch (error) {
        log.error(
            { err: error },
            "onboarding: error fetching complete onboarding data"
        );
        return {};
    }
}
