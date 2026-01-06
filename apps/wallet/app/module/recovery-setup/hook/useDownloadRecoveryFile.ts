import { isAndroid, isTauri } from "@frak-labs/app-essentials/utils/platform";
import type { RecoveryFileContent } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { recoverySetupKey } from "@/module/recovery-setup/queryKeys/recovery-setup";

const JSON_MIME_TYPE = "application/json";

/**
 * Create a JSON blob from file content
 */
function createJsonBlob(fileContent: string): Blob {
    return new Blob([fileContent], { type: JSON_MIME_TYPE });
}

/**
 * Try to share file using Web Share API (mobile)
 */
async function tryShareFile(
    fileContent: string,
    fileName: string
): Promise<boolean> {
    if (!navigator.share || !navigator.canShare) {
        return false;
    }

    const file = new File([createJsonBlob(fileContent)], fileName, {
        type: JSON_MIME_TYPE,
    });

    const shareData = { title: fileName, files: [file] };

    if (!navigator.canShare(shareData)) {
        return false;
    }

    try {
        await navigator.share(shareData);
        return true;
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new Error("Download cancelled by user");
        }
        console.warn("Share API failed, using fallback:", error);
        return false;
    }
}

/**
 * Download file using anchor element (mobile fallback)
 */
async function downloadViaAnchor(
    fileContent: string,
    fileName: string
): Promise<void> {
    const url = URL.createObjectURL(createJsonBlob(fileContent));
    const anchor = document.createElement("a");

    anchor.style.display = "none";
    anchor.href = url;
    anchor.download = fileName;
    anchor.target = "_blank";

    document.body.appendChild(anchor);

    try {
        await new Promise<void>((resolve, reject) => {
            requestAnimationFrame(() => {
                try {
                    anchor.click();
                    // Allow time for download to initiate
                    setTimeout(resolve, 500);
                } catch (error) {
                    reject(error);
                }
            });
        });
    } finally {
        // Cleanup after download initiates
        setTimeout(() => {
            anchor.remove();
            URL.revokeObjectURL(url);
        }, 2000);
    }
}

/**
 * Download file using standard web method
 */
function downloadViaWeb(fileContent: string, fileName: string): void {
    const url = URL.createObjectURL(createJsonBlob(fileContent));
    const anchor = document.createElement("a");

    document.body.appendChild(anchor);
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

/**
 * Download file using Tauri native share plugin (Android)
 * Writes file to Download directory then opens native share sheet
 */
async function downloadViaTauriShare(
    fileContent: string,
    fileName: string
): Promise<void> {
    const { invoke } = await import("@tauri-apps/api/core");
    const { downloadDir, join } = await import("@tauri-apps/api/path");
    const { writeTextFile, BaseDirectory } = await import(
        "@tauri-apps/plugin-fs"
    );

    // Write file to Download directory (accessible for sharing on Android)
    await writeTextFile(fileName, fileContent, {
        baseDir: BaseDirectory.Download,
    });

    // Get full path and share via native Android share sheet
    const dlDir = await downloadDir();
    const fullPath = await join(dlDir, fileName);

    // Android share intents don't return completion status - the promise hangs
    // until the app is killed. We catch errors but don't await completion.
    invoke("plugin:share|share_file", {
        path: fullPath,
        mime: JSON_MIME_TYPE,
    }).catch((error) => {
        console.error("Failed to open share sheet:", error);
    });

    // Allow time for share sheet to open before proceeding
    await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * Hook used to trigger the download of the recovery file
 */
export function useDownloadRecoveryFile() {
    const { mutate, mutateAsync, ...mutationStuff } = useMutation({
        mutationKey: recoverySetupKey.downloadRecoveryFile,
        gcTime: 0,
        mutationFn: async ({ file }: { file: RecoveryFileContent }) => {
            const fileName = `nexus-recovery-${file.initialWallet.address}.json`;
            const fileContent = JSON.stringify(file, null, 2);

            // Android: Use native Tauri share plugin
            if (isAndroid()) {
                await downloadViaTauriShare(fileContent, fileName);
                return;
            }

            // iOS/Tauri: Use Web Share API with anchor fallback
            if (isTauri()) {
                const shared = await tryShareFile(fileContent, fileName);
                if (!shared) {
                    await downloadViaAnchor(fileContent, fileName);
                }
                return;
            }

            // Web: Use standard download
            downloadViaWeb(fileContent, fileName);
        },
    });

    return {
        ...mutationStuff,
        downloadRecoveryFileAsync: mutateAsync,
        downloadRecoveryFile: mutate,
    };
}
