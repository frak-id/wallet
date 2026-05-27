import { CalendarIcon } from "@frak-labs/design-system/icons";
import { chip } from "./DateRangeChip.css";

// Visual-only chip in v1 — backend doesn't accept date-range filters yet,
// so the click handler is intentionally a no-op. Wire up to a calendar
// popover + query filter once the backend exposes range params.
export function DateRangeChip() {
    return (
        <button type="button" className={chip} disabled>
            <CalendarIcon width={16} height={16} />
            Date range
        </button>
    );
}
