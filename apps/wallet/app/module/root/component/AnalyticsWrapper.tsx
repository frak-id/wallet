import { OpenPanel } from "@openpanel/web";
import { Analytics } from "@shared/module/component/Analytics";
import { useEffect } from "react";

export const openPanel = new OpenPanel({
    apiUrl: process.env.OPEN_PANEL_API_URL,
    clientId: process.env.OPEN_PANEL_WALLET_CLIENT_ID ?? "",
    trackScreenViews: true,
    trackOutgoingLinks: true,
    trackAttributes: true,
});

/**
 * AnalyticsWrapper component
 *
 * This component is responsible for integrating analytics tracking into the application.
 * It wraps around child components and can log analytics events based on user interactions.
 *
 * @returns {null} - Returns null.
 */
export function AnalyticsWrapper() {
    const websiteId = process.env.UMAMI_WALLET_WEBSITE_ID;

    useEffect(() => {
        openPanel.init();
    }, []);

    if (websiteId) {
        return <Analytics websiteId={websiteId} />;
    }

    return null;
}
