import { Upload } from "@/assets/icons/Upload";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Slider } from "@/module/common/component/Slider";
import { useCallback, useRef, useState } from "react";
import AvatarEditor from "react-avatar-editor";
import { FileUploader } from "react-drag-drop-files";
import styles from "./index.module.css";

const avatarEditorSize = 250;

export function AvatarModal() {
    const editor = useRef<AvatarEditor | null>(null);
    const [image, setImage] = useState<string | File>();
    const [scale, setScale] = useState<number>(1);

    /**
     * Handle the upload of a file
     */
    const handleChange = useCallback(async (file: File | null) => {
        if (!file) {
            setImage(undefined);
            return;
        }
        setImage(file);
    }, []);

    const handleScale = (value: number[]) => {
        setScale(value[0]);
    };

    return (
        <AlertDialog
            title={"Choose profile picture"}
            text={
                <>
                    <FileUploader
                        handleChange={handleChange}
                        label={"Upload or drag recovery file"}
                        types={["jpg", "jpeg", "png", "gif"]}
                        hoverTitle={" "}
                    />
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
                            />
                            <Slider
                                label={"Zoom"}
                                defaultValue={[1]}
                                min={1}
                                max={2}
                                step={0.01}
                                onValueChange={handleScale}
                            />
                            <ButtonRipple
                                size={"small"}
                                className={styles.avatarModal__button}
                                onClick={async () => {
                                    if (!editor?.current) return;
                                    // This returns a HTMLCanvasElement, it can be made into a data URL or a blob,
                                    // drawn on another canvas, or added to the DOM.
                                    const canvas = editor.current.getImage();
                                    console.log(canvas.toDataURL("image/jpeg"));

                                    // If you want the image resized to the canvas size (also a HTMLCanvasElement)
                                    const canvasScaled =
                                        editor.current.getImageScaledToCanvas();
                                    console.log(
                                        canvasScaled.toDataURL("image/jpeg")
                                    );
                                }}
                            >
                                Save
                            </ButtonRipple>
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
