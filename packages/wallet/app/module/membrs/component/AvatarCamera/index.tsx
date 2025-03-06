import { isConnectedVideoDevices } from "@/module/membrs/utils/isConnectedVideoDevices";
import { Button } from "@shared/module/component/Button";
import {
    type Dispatch,
    type SetStateAction,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import Webcam from "react-webcam";
import styles from "./index.module.css";

type AvatarCameraProps = {
    setImage: Dispatch<SetStateAction<string | File | undefined>>;
};

/**
 * Camera component for capturing user avatar images
 */
export function AvatarCamera({ setImage }: AvatarCameraProps) {
    const [isVideoDeviceAvailable, setIsVideoDeviceAvailable] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);

    // Check if video devices are available on component mount
    useEffect(() => {
        const checkVideoDevices = async () => {
            const hasVideoDevices = await isConnectedVideoDevices();
            setIsVideoDeviceAvailable(hasVideoDevices);
        };

        checkVideoDevices();
    }, []);

    if (!isVideoDeviceAvailable) {
        return null;
    }

    return (
        <div>
            <CameraButton
                isCameraActive={isCameraActive}
                onToggleCamera={() => setIsCameraActive(!isCameraActive)}
            />

            {isCameraActive && (
                <CameraModal
                    onCapture={(imageSrc) => {
                        setImage(imageSrc);
                        setIsCameraActive(false);
                    }}
                />
            )}
        </div>
    );
}

type CameraButtonProps = {
    isCameraActive: boolean;
    onToggleCamera: () => void;
};

/**
 * Button to toggle camera activation
 */
function CameraButton({ isCameraActive, onToggleCamera }: CameraButtonProps) {
    return (
        <p className={styles.avatarCamera__buttonWrapper}>
            <Button
                onClick={onToggleCamera}
                className={styles.avatarCamera__button}
            >
                {isCameraActive
                    ? "Stop Camera"
                    : "Take a picture with your camera"}
            </Button>
        </p>
    );
}

type CameraModalProps = {
    onCapture: (imageSrc: string) => void;
};

/**
 * Modal containing webcam and capture button
 */
function CameraModal({ onCapture }: CameraModalProps) {
    const webcamRef = useRef<Webcam | null>(null);

    const handleCapture = useCallback(() => {
        const imageSrc = webcamRef?.current?.getScreenshot();
        if (!imageSrc) return;
        onCapture(imageSrc);
    }, [onCapture]);

    return createPortal(
        <div className={styles.avatarCamera__video}>
            <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/webp"
                width={"100%"}
                className={styles.avatarCamera__webcam}
            />
            <Button onClick={handleCapture}>Capture photo</Button>
        </div>,
        document.body
    );
}
