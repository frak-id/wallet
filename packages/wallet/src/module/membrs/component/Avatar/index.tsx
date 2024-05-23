import { uploadProfilePhotoAtom } from "@/module/membrs/atoms/uploadProfilePhoto";
import { userAtom } from "@/module/membrs/atoms/user";
import { AvatarModal } from "@/module/membrs/component/AvatarModal";
import { useAtomValue } from "jotai";
import styles from "./index.module.css";

export function Avatar({ withUpload = false }: { withUpload?: boolean }) {
    // Get the user from the atom
    const user = useAtomValue(userAtom);

    // Get the profile photo from the avatar upload
    const profilePhoto = useAtomValue(uploadProfilePhotoAtom);

    return (
        <div className={styles.avatar}>
            <img
                src={profilePhoto ?? user?.photo ?? "/images/avatar.png"}
                alt={"avatar"}
                width={126}
                height={126}
            />
            {withUpload && <AvatarModal />}
        </div>
    );
}
