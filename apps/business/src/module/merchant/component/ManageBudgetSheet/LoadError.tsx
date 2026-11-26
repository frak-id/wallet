import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useTranslation } from "react-i18next";
import * as styles from "./manage-budget-sheet.css";

export function LoadError({ onRetry }: { onRetry: () => void }) {
    const { t } = useTranslation();

    return (
        <Stack space="xs" align="center">
            <p className={styles.errorText}>{t("funding.error")}</p>
            <Button
                variant="secondary"
                size="small"
                width="auto"
                onClick={onRetry}
            >
                {t("funding.retry")}
            </Button>
        </Stack>
    );
}
