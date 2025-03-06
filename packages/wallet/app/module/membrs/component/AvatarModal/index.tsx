import { AlertDialog } from "@/module/common/component/AlertDialog";
import { uploadProfilePhotoAtom } from "@/module/membrs/atoms/uploadProfilePhoto";
import { Upload } from "@shared/module/asset/icons/Upload";
import { Button } from "@shared/module/component/Button";
import { Slider } from "@shared/module/component/Slider";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactAvatarEditor from "react-avatar-editor";
import { FileUploader } from "react-drag-drop-files";
import { AvatarCamera } from "../AvatarCamera";
import styles from "./index.module.css";

// Constants
const AVATAR_EDITOR_SIZE = 250;
const INITIAL_SCALE = 1;
const INITIAL_POSITION = { x: 0.5, y: 0.5 };
const ALLOWED_FILE_TYPES = ["jpg", "jpeg", "png", "gif", "webp"];
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.01;

// Types
type Position = {
    x: number;
    y: number;
};

type ImageSource = string | File | undefined;

/**
 * Modal component for uploading and editing profile avatar
 */
export function AvatarModal() {
    const [openModal, setOpenModal] = useState(false);
    const setProfilePhoto = useSetAtom(uploadProfilePhotoAtom);

    return (
        <AlertDialog
            open={openModal}
            onOpenChange={setOpenModal}
            title={"Choose profile picture"}
            text={
                <AvatarEditorPanel
                    setOpenModal={setOpenModal}
                    setProfilePhoto={setProfilePhoto}
                />
            }
            button={{
                label: <Upload />,
                className: `button ${styles.avatarModal__upload}`,
            }}
        />
    );
}

type AvatarEditorPanelProps = {
    setOpenModal: (open: boolean) => void;
    setProfilePhoto: (photo: string) => void;
};

/**
 * Avatar editor component with file upload, camera capture, and image editing
 */
function AvatarEditorPanel({
    setOpenModal,
    setProfilePhoto,
}: AvatarEditorPanelProps) {
    const editorRef = useRef<ReactAvatarEditor | null>(null);
    const [image, setImage] = useState<ImageSource>();
    const [scale, setScale] = useState<number>(INITIAL_SCALE);
    const [position, setPosition] = useState<Position>(INITIAL_POSITION);

    /**
     * Reset editor to initial settings
     */
    const resetEditorSettings = useCallback(() => {
        setScale(INITIAL_SCALE);
        setPosition(INITIAL_POSITION);
    }, []);

    // Reset editor settings when image changes
    useEffect(() => {
        if (!image) return;
        resetEditorSettings();
    }, [image, resetEditorSettings]);

    /**
     * Handle file upload
     */
    const handleFileUpload = useCallback(
        (file: File | null) => {
            if (!file) {
                setImage(undefined);
                return;
            }
            resetEditorSettings();
            setImage(file);
        },
        [resetEditorSettings]
    );

    /**
     * Handle zoom slider change
     */
    const handleZoom = (value: number[]) => {
        setScale(value[0]);
    };

    /**
     * Save the edited image
     */
    const handleSave = () => {
        if (!editorRef?.current) return;

        const canvas = editorRef.current.getImageScaledToCanvas();
        const imageDataUrl = canvas.toDataURL("image/webp");

        setProfilePhoto(imageDataUrl);
        setOpenModal(false);
    };

    return (
        <>
            <FileUploader
                handleChange={handleFileUpload}
                label={"Upload or drag recovery file"}
                types={ALLOWED_FILE_TYPES}
                hoverTitle={" "}
                classes={`${styles.avatarModal__uploader}`}
            />

            <AvatarCamera setImage={setImage} />

            {image && (
                <ImageEditor
                    image={image}
                    scale={scale}
                    position={position}
                    editorRef={editorRef}
                    onPositionChange={setPosition}
                    onZoom={handleZoom}
                    onSave={handleSave}
                />
            )}
        </>
    );
}

type ImageEditorProps = {
    image: ImageSource;
    scale: number;
    position: Position;
    editorRef: React.RefObject<ReactAvatarEditor | null>;
    onPositionChange: (position: Position) => void;
    onZoom: (value: number[]) => void;
    onSave: () => void;
};

/**
 * Image editor component with zoom and position controls
 */
function ImageEditor({
    image,
    scale,
    position,
    editorRef,
    onPositionChange,
    onZoom,
    onSave,
}: ImageEditorProps) {
    return (
        <div className={styles.avatarModal__editor}>
            <ReactAvatarEditor
                ref={editorRef}
                image={image as string | File}
                width={AVATAR_EDITOR_SIZE}
                height={AVATAR_EDITOR_SIZE}
                border={1}
                color={[0, 0, 0, 0.4]}
                scale={scale}
                rotate={0}
                borderRadius={AVATAR_EDITOR_SIZE}
                position={position}
                onPositionChange={onPositionChange}
            />

            <Slider
                label={"Zoom"}
                defaultValue={[scale]}
                value={[scale]}
                min={INITIAL_SCALE}
                max={MAX_ZOOM}
                step={ZOOM_STEP}
                onValueChange={onZoom}
            />

            <Button className={styles.avatarModal__button} onClick={onSave}>
                Save
            </Button>
        </div>
    );
}
