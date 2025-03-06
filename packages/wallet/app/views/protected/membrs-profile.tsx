import { Grid } from "@/module/common/component/Grid";
import { Title } from "@/module/common/component/Title";
import { Avatar } from "@/module/membrs/component/Avatar";
import { ProfileForm } from "@/module/membrs/component/ProfileForm";
import styles from "./membrs-profile.module.css";

export default function MembersProfile() {
    return (
        <Grid>
            <Title className={styles.profile__title}>Custom your profile</Title>
            <div className={styles.profile__intro}>
                <p>
                    Custom your profile to join creators’ community and be
                    rewarded for your engagement
                </p>
                <p>
                    Benefit from the advantages offered by designers and their
                    partners
                </p>
            </div>
            <div className={styles.profile__edit}>
                <Avatar withUpload={true} />
                <ProfileForm />
            </div>
        </Grid>
    );
}
