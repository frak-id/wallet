import {
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogTitle,
    AlertDialog as DSAlertDialog,
} from "@frak-labs/design-system/components/AlertDialog";
import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { welcomePopupStore } from "@/stores/welcomePopupStore";
import * as styles from "./welcome-popup.css";

/**
 * One-time "new dashboard is here" announcement, shown on the first
 * authenticated visit and dismissed for good once acknowledged.
 */
export function WelcomePopup() {
    const { t } = useTranslation();
    const hasSeenWelcome = welcomePopupStore((s) => s.hasSeenWelcome);
    const markWelcomeSeen = welcomePopupStore((s) => s.markWelcomeSeen);

    return (
        <DSAlertDialog
            open={!hasSeenWelcome}
            onOpenChange={(open) => {
                if (!open) {
                    markWelcomeSeen();
                }
            }}
        >
            <AlertDialogContent className={styles.content}>
                <Stack space="l" align="center">
                    <Stack space="xs" align="center">
                        <AlertDialogTitle asChild>
                            <Text
                                variant="heading2"
                                color="primary"
                                align="center"
                                className={styles.title}
                            >
                                {t("welcomePopup.title")}
                            </Text>
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <Text
                                variant="body"
                                color="secondary"
                                align="center"
                                className={styles.description}
                            >
                                {t("welcomePopup.description")}
                            </Text>
                        </AlertDialogDescription>
                    </Stack>
                    <AlertDialogAction asChild>
                        <Button variant="primary" size="large" width="full">
                            {t("welcomePopup.cta")}
                        </Button>
                    </AlertDialogAction>
                </Stack>
            </AlertDialogContent>
        </DSAlertDialog>
    );
}
