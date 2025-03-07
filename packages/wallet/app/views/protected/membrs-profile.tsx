import { Grid } from "@/module/common/component/Grid";
import { Title } from "@/module/common/component/Title";
import { Avatar } from "@/module/membrs/component/Avatar";
import { ProfileForm } from "@/module/membrs/component/ProfileForm";
import { useTranslation } from "react-i18next";
import styles from "./membrs-profile.module.css";

export default function MembersProfile() {
    const { t } = useTranslation();

    return (
        <Grid>
            <Title className={styles.profile__title}>
                {t("wallet.membrs.profile.title")}
            </Title>
            <div className={styles.profile__intro}>
                <p>{t("wallet.membrs.profile.text1")}</p>
                <p>{t("wallet.membrs.profile.text2")}</p>
            </div>
            <div className={styles.profile__edit}>
                <Avatar withUpload={true} />
                <ProfileForm />
            </div>
        </Grid>
    );
}
