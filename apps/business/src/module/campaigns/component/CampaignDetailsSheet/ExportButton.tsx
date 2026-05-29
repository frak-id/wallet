import { Button } from "@frak-labs/design-system/components/Button";
import { useTranslation } from "react-i18next";
import { ExportIcon } from "./ExportIcon";

/**
 * Export affordance from the Figma redesign. Visual-only for now — a CSV/export
 * endpoint does not exist yet, so the click is a no-op placeholder.
 */
export function ExportButton() {
    const { t } = useTranslation();
    return (
        <Button
            variant="secondary"
            size="small"
            width="auto"
            rightIcon={<ExportIcon />}
            onClick={() => {
                // TODO: wire export once a backend export endpoint lands.
            }}
        >
            {t("campaigns.details.export")}
        </Button>
    );
}
