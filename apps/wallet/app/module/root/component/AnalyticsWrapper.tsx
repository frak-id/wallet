import { Analytics } from "@shared/module/component/Analytics";
import { useEffect } from "react";
import { openPanel } from "../../common/analytics";

/**
 * AnalyticsWrapper component
 *
 * This component is responsible for integrating analytics tracking into the application.
 * It wraps around child components and can log analytics events based on user interactions.
 */
export function AnalyticsWrapper() {
    const websiteId = process.env.UMAMI_WALLET_WEBSITE_ID;

    useEffect(() => {
        openPanel?.init();
    }, []);

    if (websiteId) {
        return <Analytics websiteId={websiteId} />;
    }

    return null;
}
