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
    OpenPanelFilterOperator,
} from "./config";
export {
    aggregateFunnelSteps,
    buildFunnelSeries,
    type FunnelStepDefinition,
    type FunnelStepResult,
    seriePreviousSum,
    serieSum,
    sumSeriesAtPositions,
} from "./funnels";
export { OpenPanelExportClient } from "./OpenPanelExportClient";

export const openPanelExportClient = new OpenPanelExportClient();
