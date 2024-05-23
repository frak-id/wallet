import { Upload } from "@/assets/icons/Upload";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { ButtonRippleSmall } from "@/module/common/component/ButtonRippleSmall";
import { Slider } from "@/module/common/component/Slider";
import { uploadProfilePhotoAtom } from "@/module/membrs/atoms/uploadProfilePhoto";
import { AvatarCamera } from "@/module/membrs/component/AvatarCamera";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import AvatarEditor from "react-avatar-editor";
import { FileUploader } from "react-drag-drop-files";
import styles from "./index.module.css";

const avatarEditorSize = 250;

export function AvatarModal() {
    const editor = useRef<AvatarEditor | null>(null);
    const [image, setImage] = useState<string | File>();
    const [scale, setScale] = useState<number>(1);
    const [position, setPosition] = useState({
        x: 0.5,
        y: 0.5,
    });
    const [openModal, setOpenModal] = useState(false);

    // Get the profile photo from the avatar upload
    const setProfilePhoto = useSetAtom(uploadProfilePhotoAtom);

    /**
     * Reset the editor when the image changes
     */
    useEffect(() => {
        if (!image) return;
        setScale(1);
        setPosition({ x: 0.5, y: 0.5 });
    }, [image]);

    /**
     * Handle the upload of a file
     * @param file
     */
    const handleChange = useCallback(async (file: File | null) => {
        if (!file) {
            setImage(undefined);
            return;
        }
        setScale(1);
        setPosition({ x: 0.5, y: 0.5 });
        setImage(file);
    }, []);

    /**
     * Handle the scale of the image
     * @param value
     */
    const handleScale = (value: number[]) => {
        setScale(value[0]);
    };

    return (
        <AlertDialog
            open={openModal}
            onOpenChange={setOpenModal}
            title={"Choose profile picture"}
            text={
                <>
                    <FileUploader
                        handleChange={handleChange}
                        label={"Upload or drag recovery file"}
                        types={["jpg", "jpeg", "png", "gif", "webp"]}
                        hoverTitle={" "}
                        classes={`${styles.avatarModal__uploader}`}
                    />
                    <AvatarCamera setImage={setImage} />
                    {image && (
                        <div className={styles.avatarModal__editor}>
                            <AvatarEditor
                                ref={editor}
                                image={image}
                                width={avatarEditorSize}
                                height={avatarEditorSize}
                                border={1}
                                color={[0, 0, 0, 0.4]}
                                scale={scale}
                                rotate={0}
                                borderRadius={avatarEditorSize}
                                position={position}
                                onPositionChange={setPosition}
                            />
                            <Slider
                                label={"Zoom"}
                                defaultValue={[scale]}
                                value={[scale]}
                                min={1}
                                max={4}
                                step={0.01}
                                onValueChange={handleScale}
                            />
                            <ButtonRippleSmall
                                className={styles.avatarModal__button}
                                onClick={() => {
                                    if (!editor?.current) return;
                                    const canvasScaled =
                                        editor.current.getImageScaledToCanvas();
                                    setProfilePhoto(
                                        canvasScaled.toDataURL("image/webp")
                                    );
                                    setOpenModal(false);
                                }}
                            >
                                Save
                            </ButtonRippleSmall>
                        </div>
                    )}
                </>
            }
            button={{
                label: <Upload />,
                className: `button ${styles.avatarModal__upload}`,
            }}
        />
    );
}
