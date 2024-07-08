import { AlertDialog } from "@/module/common/component/AlertDialog";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { X } from "lucide-react";
import styles from "./index.module.css";

export function ModalBurn({
    burnCommunityToken,
    openModal,
    setOpenModal,
    isLoading,
    className = "",
}: {
    burnCommunityToken: () => void;
    openModal: boolean;
    setOpenModal: (open: boolean) => void;
    isLoading: boolean;
    className?: string;
}) {
    return (
        <AlertDialog
            showCloseButton={false}
            open={openModal}
            onOpenChange={(open) => setOpenModal(open)}
            text={
                <>
                    <p>Are you sure you want to leave this community?</p>
                    <span className={styles.modalBurn__buttons}>
                        <ButtonRipple onClick={() => setOpenModal(false)}>
                            CANCEL
                        </ButtonRipple>
                        <ButtonRipple
                            onClick={() => burnCommunityToken()}
                            isLoading={isLoading}
                            disabled={isLoading}
                        >
                            CONFIRM
                        </ButtonRipple>
                    </span>
                </>
            }
            button={{
                label: (
                    <span className={`button ${className}`}>
                        <X color={"red"} />
                    </span>
                ),
            }}
        />
    );
}
