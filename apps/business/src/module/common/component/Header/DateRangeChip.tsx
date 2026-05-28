import { CalendarIcon } from "@frak-labs/design-system/icons";
import { getRouteApi } from "@tanstack/react-router";
import type { DateRange } from "react-day-picker";
import { DateRangePopover } from "@/module/common/component/DateRangePopover";
import {
    formatRangeLabel,
    isoToDateRange,
    toIso,
} from "@/module/common/component/DateRangePopover/presets";
import { chip, chipActive } from "./DateRangeChip.css";

// The chip only renders on the overview page (Header gates it via
// `showDateRange`), so binding to that route's API is safe. Resolved inside
// the component so importing this file doesn't call into the router.
const ROUTE_ID = "/_restricted/m/$merchantId/campaigns/overview";

export function DateRangeChip() {
    const routeApi = getRouteApi(ROUTE_ID);
    const { from, to } = routeApi.useSearch();
    const navigate = routeApi.useNavigate();

    const hasRange = Boolean(from && to);

    function handleChange(range: DateRange | undefined) {
        navigate({
            search: (prev) => ({
                ...prev,
                from: range?.from ? toIso(range.from) : undefined,
                to: range?.to ? toIso(range.to) : undefined,
            }),
        });
    }

    return (
        <DateRangePopover
            value={isoToDateRange(from, to)}
            onChange={handleChange}
            align="end"
            liftAboveHeader
            trigger={
                <button
                    type="button"
                    className={hasRange ? `${chip} ${chipActive}` : chip}
                >
                    <CalendarIcon width={16} height={16} />
                    {formatRangeLabel(from, to)}
                </button>
            }
        />
    );
}
