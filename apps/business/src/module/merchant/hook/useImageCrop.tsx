import { useCallback, useState } from "react";
import {
    ImageCropDialog,
    type ImageCropRequest,
} from "@/module/merchant/component/ImageCropDialog";
import { loadImage } from "@/module/merchant/utils/cropImage";
import { type ImageKind, planCrop } from "@/module/merchant/utils/imageRatio";

type PendingCrop = ImageCropRequest & {
    resolve: (file: File | null) => void;
};

/**
 * `prepareImage` resolves to the file to upload: the merchant's crop, the
 * original when they keep it (or no crop applies), or `null` if they cancel.
 * Render `cropDialog` next to the dropzone.
 */
export function useImageCrop(kind: ImageKind) {
    const [pending, setPending] = useState<PendingCrop | null>(null);

    const prepareImage = useCallback(
        async (file: File): Promise<File | null> => {
            // SVGs skip the backend ratio check, and a crop would rasterise them.
            if (file.type === "image/svg+xml") return file;

            const src = URL.createObjectURL(file);
            // Unreadable files go up as-is so the backend reports why.
            const image = await loadImage(src).catch(() => null);
            const size = image && {
                width: image.naturalWidth,
                height: image.naturalHeight,
            };
            const plan = size && planCrop(size, kind);
            if (!size || !plan) {
                URL.revokeObjectURL(src);
                return file;
            }

            return new Promise((resolve) =>
                setPending({ ...plan, file, src, size, resolve })
            );
        },
        [kind]
    );

    const cropDialog = pending && (
        <ImageCropDialog
            key={pending.src}
            request={pending}
            kind={kind}
            onSettle={(file) => {
                URL.revokeObjectURL(pending.src);
                setPending(null);
                pending.resolve(file);
            }}
        />
    );

    return { prepareImage, cropDialog };
}
