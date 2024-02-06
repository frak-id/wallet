import { useCallback, useState } from "react";

function oldSchoolCopy(text: string) {
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = text;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand("copy");
    document.body.removeChild(tempTextArea);
}

/**
 * From https://github.com/uidotdev/usehooks
 * Need to reimport since it uses fcked up react import
 */
export function useCopyToClipboard(): [
    string | null,
    (value: string) => Promise<void>,
] {
    const [state, setState] = useState<string | null>(null);

    const copyToClipboard = useCallback(async (value: string) => {
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
                setState(value);
            } else {
                throw new Error("writeText not supported");
            }
        } catch {
            oldSchoolCopy(value);
            setState(value);
        }
    }, []);

    return [state, copyToClipboard];
}
