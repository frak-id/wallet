import { useCallback, useState } from "preact/hooks";

interface UseClipboardOptions {
    successDuration?: number;
}

export function useCopyToClipboard(options: UseClipboardOptions = {}) {
    const { successDuration = 2000 } = options;
    const [copied, setCopied] = useState(false);

    const copy = useCallback(
        async (text: string) => {
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                } else {
                    const textArea = document.createElement("textarea");
                    textArea.value = text;
                    textArea.style.position = "fixed";
                    textArea.style.opacity = "0";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();

                    try {
                        document.execCommand("copy");
                        setCopied(true);
                    } catch (err) {
                        console.error("Failed to copy text:", err);
                        return false;
                    } finally {
                        textArea.remove();
                    }
                }

                setTimeout(() => {
                    setCopied(false);
                }, successDuration);

                return true;
            } catch (err) {
                console.error("Failed to copy text:", err);
                return false;
            }
        },
        [successDuration]
    );

    return { copy, copied } as const;
}
