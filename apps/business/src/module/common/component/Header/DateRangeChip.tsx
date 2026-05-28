import { CalendarIcon } from "@frak-labs/design-system/icons";
import { getRouteApi, useSearch } from "@tanstack/react-router";
import type { DateRange } from "react-day-picker";
import { DateRangePopover } from "@/module/common/component/DateRangePopover";
import {
    formatRangeLabel,
    isoToDateRange,
    toIso,
} from "@/module/common/component/DateRangePopover/presets";
import { chip, chipActive } from "./DateRangeChip.css";

// The chip is gated by the Header via `useLocation` pathname, which flips to
// the campaigns index path during the pending window *before* that route's
// match commits. Reading search non-strictly keeps that transient render from
// throwing "could not find an active match". Navigation stays bound to the
// index route's typed API (only invoked once the route is settled).
const ROUTE_ID = "/_restricted/m/$merchantId/campaigns/";

export function DateRangeChip() {
    const navigate = getRouteApi(ROUTE_ID).useNavigate();
    const { from, to } = useSearch({ strict: false }) as {
        from?: string;
        to?: string;
    };

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
