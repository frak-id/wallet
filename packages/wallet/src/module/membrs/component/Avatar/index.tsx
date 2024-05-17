import { AvatarModal } from "@/module/membrs/component/AvatarModal";
import styles from "./index.module.css";

export function Avatar({ withUpload = false }: { withUpload?: boolean }) {
    return (
        <div className={styles.avatar}>
            <img
                src={"/images/avatar.png"}
                alt={"avatar"}
                width={126}
                height={126}
            />
            {withUpload && <AvatarModal />}
        </div>
    );
}
