import { Badge } from "@frak-labs/design-system/components/Badge";
import { useTranslation } from "react-i18next";
import type { PushHistoryStatus } from "./types";

const VARIANT: Record<PushHistoryStatus, "warning" | "success"> = {
    scheduled: "warning",
    sent: "success",
};

/**
 * Status pill for a push broadcast — amber for `scheduled`, green for `sent`,
 * matching the design's table-cell tag treatment.
 */
export function PushHistoryStatusBadge({
    status,
}: {
    status: PushHistoryStatus;
}) {
    const { t } = useTranslation();
    return (
        <Badge variant={VARIANT[status]} size="small">
            {t(`push.history.status.${status}`)}
        </Badge>
    );
}
