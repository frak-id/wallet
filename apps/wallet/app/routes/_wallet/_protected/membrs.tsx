import { buttonVariants } from "@frak-labs/ui/component/Button";
import {
    selectUser,
    selectUserSetupLater,
    userStore,
} from "@frak-labs/wallet-shared";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Grid } from "@/module/common/component/Grid";
import { Title } from "@/module/common/component/Title";
import { Membrs } from "@/module/membrs/assets/Membrs";
import styles from "@/module/membrs/page/MembrsPage.module.css";

export const Route = createFileRoute("/_wallet/_protected/membrs")({
    component: MembrsPage,
});

/**
 * MembrsPage
 *
 * Introduction page for the Membrs feature
 *
 * @returns {JSX.Element} The rendered membrs page
 */
function MembrsPage() {
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
                <Link to="/membrs/fanclub" className={buttonVariants()}>
                    {t("wallet.membrs.introduction.button")}
                </Link>
            </p>
        </Grid>
    ) : null;
}
