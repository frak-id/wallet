import { useMutation } from "@tanstack/react-query";
import { recoverySetupKey } from "@/module/recovery-setup/queryKeys/recovery-setup";
import type { RecoveryFileContent } from "@/types/Recovery";

/**
 * Hook used to trigger the download of the recovery file
 */
export function useDownloadRecoveryFile() {
    const { mutate, mutateAsync, ...mutationStuff } = useMutation({
        mutationKey: recoverySetupKey.downloadRecoveryFile,
        gcTime: 0,
        mutationFn: async ({ file }: { file: RecoveryFileContent }) => {
            // Build the blob with the file product
            const blob = new Blob([JSON.stringify(file)], {
                type: "text/json;charset=utf-8",
            });
            const url = URL.createObjectURL(blob);
            // Create the element we will use to trigger the download
            const downloadAnchorNode = document.createElement("a");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.href = url;
            downloadAnchorNode.download = `nexus-recovery-${file.initialWallet.address}.json`;
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            // Free up memory by revoking the object URL
            URL.revokeObjectURL(url);
        },
    });

    return {
        ...mutationStuff,
        downloadRecoveryFileAsync: mutateAsync,
        downloadRecoveryFile: mutate,
    };
}
