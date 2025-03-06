import { uploadProfilePhotoAtom } from "@/module/membrs/atoms/uploadProfilePhoto";
import { userAtom } from "@/module/membrs/atoms/user";
import { AvatarModal } from "@/module/membrs/component/AvatarModal";
import { useAtomValue } from "jotai";
import defaultAvatar from "./assets/avatar.png?url";
import styles from "./index.module.css";

export function Avatar({ withUpload = false }: { withUpload?: boolean }) {
    // Get the user from the atom
    const user = useAtomValue(userAtom);

    // Get the profile photo from the avatar upload
    const profilePhoto = useAtomValue(uploadProfilePhotoAtom);

    return (
        <div className={styles.avatar}>
            <img
                src={getAvatar(profilePhoto, user?.photo)}
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
