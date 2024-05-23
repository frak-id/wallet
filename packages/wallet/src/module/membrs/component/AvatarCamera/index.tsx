import { ButtonRippleSmall } from "@/module/common/component/ButtonRippleSmall";
import { isConnectedVideoDevices } from "@/module/common/utils/isConnectedVideoDevices";
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

export function AvatarCamera({
    setImage,
}: { setImage: Dispatch<SetStateAction<string | File | undefined>> }) {
    const [isVideoDeviceAvailable, setIsVideoDeviceAvailable] = useState(false);
    const [takePicture, setTakePicture] = useState(false);

    // Get the video devices
    const webcamRef = useRef<Webcam | null>(null);
    const capture = useCallback(() => {
        const imageSrc = webcamRef?.current?.getScreenshot();
        if (!imageSrc) return;
        setTakePicture(false);
        setImage(imageSrc);
    }, [setImage]);

    /**
     * Check if the video devices are available
     */
    useEffect(() => {
        isConnectedVideoDevices().then(setIsVideoDeviceAvailable);
    }, []);

    return (
        <>
            {isVideoDeviceAvailable && (
                <>
                    <p>
                        <ButtonRippleSmall
                            onClick={() => setTakePicture(!takePicture)}
                            className={styles.avatarCamera__button}
                        >
                            {takePicture
                                ? "Stop Camera"
                                : "Take a picture with your camera"}
                        </ButtonRippleSmall>
                    </p>
                    {takePicture &&
                        createPortal(
                            <div className={styles.avatarCamera__video}>
                                <Webcam
                                    audio={false}
                                    ref={webcamRef}
                                    screenshotFormat="image/webp"
                                    width={"100%"}
                                    className={styles.avatarCamera__webcam}
                                />
                                <ButtonRippleSmall
                                    onClick={() => {
                                        capture();
                                    }}
                                >
                                    Capture photo
                                </ButtonRippleSmall>
                            </div>,
                            document.body
                        )}
                </>
            )}
        </>
    );
}
