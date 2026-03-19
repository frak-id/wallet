import { Accordion } from "@frak-labs/design-system/components/Accordion";
import { createFileRoute } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Trans } from "react-i18next";
import { Grid } from "@/module/common/component/Grid";
import { Step1 } from "@/module/recovery-setup/component/Setup/Step1";
import { Step2 } from "@/module/recovery-setup/component/Setup/Step2";
import { Step3 } from "@/module/recovery-setup/component/Setup/Step3";
import { Step4 } from "@/module/recovery-setup/component/Setup/Step4";
import {
    recoveryStore,
    selectRecoveryStep,
} from "@/module/stores/recoveryStore";
import * as styles from "./settings-recovery.css";

const MAX_STEPS = 5;

export const Route = createFileRoute("/_wallet/_protected/settings/recovery")({
    component: SettingsRecovery,
});

function SettingsRecovery() {
    const step = recoveryStore(selectRecoveryStep);

    useEffect(() => {
        return () => {
            if (step !== MAX_STEPS) return;
            // Reset the state when leaving the component
            recoveryStore.getState().reset();
        };
    }, [step]);

    return (
        <Grid>
            <p className={styles.setupRecoveryDisclaimer}>
                <TriangleAlert className={styles.setupRecoveryDisclaimerIcon} />{" "}
                <Trans i18nKey={"wallet.recoverySetup.disclaimer"} />
            </p>
            <Accordion type={"single"} collapsible value={`step-${step}`}>
                <Step1 />
                <Step2 />
                <Step3 />
                <Step4 />
            </Accordion>
        </Grid>
    );
}
