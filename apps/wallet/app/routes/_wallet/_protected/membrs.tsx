import { Button } from "@frak-labs/ui/component/Button";
import {
    selectUser,
    selectUserSetupLater,
    userStore,
} from "@frak-labs/wallet-shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Grid } from "@/module/common/component/Grid";
import { Title } from "@/module/common/component/Title";
import { Membrs } from "@/module/membrs/assets/Membrs";
import styles from "./membrs.module.css";

export const Route = createFileRoute("/_wallet/_protected/membrs")({
    component: Members,
});

function Members() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    // Get the user from the store
    const user = userStore(selectUser);

    // User choose to setup his profile later
    const isUserSetupLater = userStore(selectUserSetupLater);

    useEffect(() => {
        if (user || isUserSetupLater) return;

        // Redirect to the profile page if the user does not have a profile
        navigate({ to: "/membrs/profile" });
    }, [user, isUserSetupLater, navigate]);

    return user || isUserSetupLater ? (
        <Grid>
            <div className={styles.membrs__introduction}>
                <Title className={styles.membrs__title}>
                    <Membrs />
                </Title>
                <p>{t("wallet.membrs.introduction.title")}</p>
            </div>
            <p className={styles.membrs__button}>
                <Button onClick={() => navigate({ to: "/membrs/fanclub" })}>
                    {t("wallet.membrs.introduction.button")}
                </Button>
            </p>
        </Grid>
    ) : null;
}
