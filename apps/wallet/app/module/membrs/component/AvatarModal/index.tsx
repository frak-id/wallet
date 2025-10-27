import { Button } from "@frak-labs/ui/component/Button";
import { Slider } from "@frak-labs/ui/component/Slider";
import { Uploader } from "@frak-labs/ui/component/Uploader";
import { Upload } from "@frak-labs/ui/icons/Upload";
import { WalletModal } from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactAvatarEditor from "react-avatar-editor";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import { useProfilePhoto } from "@/module/membrs/context/ProfilePhotoContext";
import { AvatarCamera } from "../AvatarCamera";
import styles from "./index.module.css";

// Constants
const AVATAR_EDITOR_SIZE = 250;
const INITIAL_SCALE = 1;
const INITIAL_POSITION = { x: 0.5, y: 0.5 };
const ALLOWED_FILE_TYPES = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/gif": [".gif"],
    "image/png": [".png"],
    "image/webp": [".webp"],
};
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.01;

// Types
type Position = {
    x: number;
    y: number;
};

type ImageSource = string | File | undefined;

/**
 * Local modal state store
 * @description Store to manage the avatar modal open/close state
 */
type LocalModalState = {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
};

const useLocalModalStore = create<LocalModalState>()((set) => ({
    isOpen: false,
    setIsOpen: (isOpen) => set({ isOpen }),
}));

/**
 * Modal component for uploading and editing profile avatar
 */
export function AvatarModal() {
    const { t } = useTranslation();
    const openModal = useLocalModalStore((state) => state.isOpen);
    const setOpenModal = useLocalModalStore((state) => state.setIsOpen);

    return (
        <WalletModal
            open={openModal}
            onOpenChange={setOpenModal}
            title={t("wallet.membrs.profile.avatar.title")}
            text={<AvatarEditorPanel />}
            button={{
                label: <Upload />,
                className: `button ${styles.avatarModal__upload}`,
            }}
        />
    );
}

/**
 * Avatar editor component with file upload, camera capture, and image editing
 */
function AvatarEditorPanel() {
    const { t } = useTranslation();
    const { setUploadedPhoto } = useProfilePhoto();
    const editorRef = useRef<ReactAvatarEditor | null>(null);
    const [image, setImage] = useState<ImageSource>();
    const [scale, setScale] = useState<number>(INITIAL_SCALE);
    const [position, setPosition] = useState<Position>(INITIAL_POSITION);
    const setOpenModal = useLocalModalStore((state) => state.setIsOpen);

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
        (files: File[] | null) => {
            if (!files || files.length === 0) {
                setImage(undefined);
                return;
            }
            resetEditorSettings();
            setImage(files[0]);
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

        setUploadedPhoto(imageDataUrl);
        setOpenModal(false);
    };

    return (
        <>
            <Uploader
                onDrop={handleFileUpload}
                text={t("wallet.membrs.profile.avatar.upload")}
                accept={ALLOWED_FILE_TYPES}
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
    const { t } = useTranslation();

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
                label={t("wallet.membrs.profile.avatar.zoom")}
                defaultValue={[scale]}
                value={[scale]}
                min={INITIAL_SCALE}
                max={MAX_ZOOM}
                step={ZOOM_STEP}
                onValueChange={onZoom}
            />

            <Button className={styles.avatarModal__button} onClick={onSave}>
                {t("wallet.membrs.profile.avatar.save")}
            </Button>
        </div>
    );
}
