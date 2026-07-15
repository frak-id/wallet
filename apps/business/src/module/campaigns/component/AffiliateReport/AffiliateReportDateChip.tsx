import { CalendarIcon } from "@frak-labs/design-system/icons";
import { getRouteApi, useSearch } from "@tanstack/react-router";
import type { DateRange } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { DateRangePopover } from "@/module/common/component/DateRangePopover";
import {
    formatRangeLabel,
    isoToDateRange,
    toIso,
} from "@/module/common/component/DateRangePopover/presets";
import { getDateFnsLocale } from "@/module/common/utils/dateLocale";

const ROUTE_ID = "/_restricted/m/$merchantId/campaigns/affiliate-report";

export function AffiliateReportDateChip() {
    const { t, i18n } = useTranslation();
    const navigate = getRouteApi(ROUTE_ID).useNavigate();
    const { from, to } = useSearch({ strict: false }) as {
        from?: string;
        to?: string;
    };

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
            trigger={
                <Button
                    variant="filter"
                    size="filter"
                    icon={<CalendarIcon width={16} height={16} />}
                >
                    {formatRangeLabel(
                        from,
                        to,
                        t,
                        getDateFnsLocale(i18n.language)
                    )}
                </Button>
            }
        />
    );
}
