"use client";

import { Title } from "@/module/common/component/Title";
import { Avatar } from "@/module/membrs/component/Avatar";
import { ProfileForm } from "@/module/membrs/component/ProfileForm";
import styles from "./index.module.css";

export function Profile() {
    return (
        <>
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
        </>
    );
}
