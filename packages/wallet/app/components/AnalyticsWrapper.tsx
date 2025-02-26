import { useEnvironment } from "@/hooks/useEnvironment";
import { Analytics } from "@shared/module/component/Analytics";

/**
 * AnalyticsWrapper component
 *
 * This component is responsible for integrating analytics tracking into the application.
 * It wraps around child components and can log analytics events based on user interactions.
 *
 * @returns {null} - Returns null.
 */
export function AnalyticsWrapper() {
    const { isProduction } = useEnvironment();

    const websiteId = process.env.UMAMI_WALLET_WEBSITE_ID;

    if (isProduction && websiteId) {
        return <Analytics websiteId={websiteId} />;
    }
    return null;
}
