import { useMemo } from "react";
import { type Accept, useDropzone } from "react-dropzone";
import styles from "./index.module.css";

const focusedStyle = {
    borderColor: "#2196f3",
};

const acceptStyle = {
    borderColor: "#00e676",
};

const rejectStyle = {
    borderColor: "#ff1744",
};

type UploadProps = {
    onDrop: (files: File[]) => void;
    text?: string;
    accept?: Accept;
    disabled?: boolean;
    maxFiles?: number;
};

/**
 * Upload zone component
 * @param {UploadProps} props - The props
 * @param {Function} props.onDrop - The function to call when a file is dropped
 * @param {Accept} props.accept - The accepted file types
 * @param {string} props.text - The text to display
 * @returns {React.ReactElement} The upload zone component
 */
export function Uploader({
    onDrop,
    accept,
    text,
    disabled,
    maxFiles = 1,
}: UploadProps) {
    const {
        getRootProps,
        getInputProps,
        isFocused,
        isDragAccept,
        isDragReject,
    } = useDropzone({
        accept,
        onDrop,
        disabled,
        maxFiles,
    });

    /**
     * Get file extensions from accept prop
     * @description Extract file extensions from the accept prop values
     * @returns {string[]} The file extensions
     */
    const fileExtensions = useMemo(() => {
        if (!accept) return [];

        // Flatten all extensions from the accept object
        const extensions: string[] = [];
        for (const exts of Object.values(accept)) {
            if (Array.isArray(exts)) {
                extensions.push(...exts);
            }
        }

        // Return unique extensions
        return [...new Set(extensions)];
    }, [accept]);

    /**
     * Style based on the state
     * @description Get the style based on the state
     * @returns {React.CSSProperties} The style
     */
    const style = useMemo(
        () => ({
            ...(isFocused ? focusedStyle : {}),
            ...(isDragAccept ? acceptStyle : {}),
            ...(isDragReject ? rejectStyle : {}),
        }),
        [isFocused, isDragAccept, isDragReject]
    );

    return (
        <section>
            <div {...getRootProps({ className: styles.uploader, style })}>
                <input
                    {...getInputProps()}
                    className={styles.uploader__input}
                />
                <p className={styles.uploader__text}>
                    <span>{text}</span>
                    {fileExtensions.length > 0 && (
                        <span>{fileExtensions.join(", ")}</span>
                    )}
                </p>
            </div>
        </section>
    );
}
