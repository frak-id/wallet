import { selectUser, userStore } from "@frak-labs/wallet-shared";
import { AvatarModal } from "@/module/membrs/component/AvatarModal";
import { useProfilePhoto } from "@/module/membrs/context/ProfilePhotoContext";
import defaultAvatar from "./assets/avatar.png?url";
import styles from "./index.module.css";

export function Avatar({ withUpload = false }: { withUpload?: boolean }) {
    // Get the user from the store
    const user = userStore(selectUser);

    // Get the profile photo from the context
    const { uploadedPhoto } = useProfilePhoto();

    return (
        <div className={styles.avatar}>
            <img
                src={getAvatar(uploadedPhoto, user?.photo)}
                alt={"avatar"}
                width={126}
                height={126}
            />
            {withUpload && <AvatarModal />}
        </div>
    );
}

/**
 * Get the avatar from the profile photo or the user photo
 * @param profilePhoto
 * @param userPhoto
 * @returns
 */
function getAvatar(
    profilePhoto: string | undefined,
    userPhoto: string | undefined
) {
    if (profilePhoto) return profilePhoto;
    if (userPhoto) return userPhoto;
    return defaultAvatar;
}
