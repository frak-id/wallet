import type { OpenPanelExportConfig } from "./config";
import { OpenPanelExportClient } from "./OpenPanelExportClient";

export type {
    OpenPanelChartBreakdown,
    OpenPanelChartFilter,
    OpenPanelChartInterval,
    OpenPanelChartQuery,
    OpenPanelChartRange,
    OpenPanelChartResponse,
    OpenPanelChartSerie,
    OpenPanelChartSerieDatum,
    OpenPanelChartSeries,
    OpenPanelExportConfig,
    OpenPanelFilterOperator,
} from "./config";
export { OpenPanelExportClient } from "./OpenPanelExportClient";

function readConfig(): OpenPanelExportConfig {
    return {
        apiUrl: process.env.OPEN_PANEL_API_URL ?? "https://api.openpanel.dev",
        clientId: process.env.OPEN_PANEL_BACKEND_CLIENT_ID ?? "",
        clientSecret: process.env.OPEN_PANEL_BACKEND_CLIENT_SECRET ?? "",
        walletProjectId: process.env.OPEN_PANEL_WALLET_PROJECT_ID ?? "wallet",
    };
}

export const openPanelExportClient = new OpenPanelExportClient(readConfig());
