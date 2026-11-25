import type { CropSource } from "@frak-labs/app-essentials/media/cropImage";
import type { ImageKind } from "@frak-labs/app-essentials/media/imageRatio";
import { lazy, Suspense, useCallback, useState } from "react";

// Both load on the first drop and share the `image-crop-lazy` chunk; a static
// import of either would pull that chunk into the merchant pages.
const loadCropImage = () => import("@frak-labs/app-essentials/media/cropImage");
const ImageCropDialog = lazy(() =>
    import("@/module/merchant/component/ImageCropDialog").then((module) => ({
        default: module.ImageCropDialog,
    }))
);

type PendingCrop = {
    source: CropSource;
    settle: (file: File | null) => void;
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
            const { readCropSource, releaseCropSource } = await loadCropImage();
            const source = await readCropSource(file, kind);
            if (!source) return file;
            return new Promise((resolve) =>
                setPending({
                    source,
                    settle: (output) => {
                        releaseCropSource(source);
                        resolve(output);
                    },
                })
            );
        },
        [kind]
    );

    const cropDialog = pending && (
        <Suspense fallback={null}>
            <ImageCropDialog
                key={pending.source.src}
                request={pending.source}
                kind={kind}
                onSettle={(file) => {
                    setPending(null);
                    pending.settle(file);
                }}
            />
        </Suspense>
    );

    return { prepareImage, cropDialog };
}
