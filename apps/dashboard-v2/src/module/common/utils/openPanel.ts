import { OpenPanel } from "@openpanel/web";

/**
 * Create the open panel instance if the env variables are set
 */
export const openPanel =
    process.env.OPEN_PANEL_API_URL && process.env.OPEN_PANEL_BUSINESS_CLIENT_ID
        ? new OpenPanel({
              apiUrl: process.env.OPEN_PANEL_API_URL,
              clientId: process.env.OPEN_PANEL_BUSINESS_CLIENT_ID,
              trackScreenViews: true,
              trackOutgoingLinks: true,
              trackAttributes: false,
          })
        : undefined;
