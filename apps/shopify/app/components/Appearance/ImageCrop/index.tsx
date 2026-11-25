import type { CropSource } from "@frak-labs/app-essentials/media/cropImage";
import type { ImageKind } from "@frak-labs/app-essentials/media/imageRatio";
import { lazy, Suspense, useCallback, useState } from "react";

// Client-only and loaded on the first drop, which keeps the cropper out of SSR.
const loadCropImage = () => import("@frak-labs/app-essentials/media/cropImage");
const ImageCropPanel = lazy(() =>
    import("./ImageCropPanel").then((module) => ({
        default: module.ImageCropPanel,
    }))
);

type PendingCrop = {
    source: CropSource;
    settle: (file: File | null) => void;
};

/**
 * `prepareImage` resolves to the file to upload: the merchant's crop, the
 * original when they keep it (or no crop applies), or `null` if they cancel.
 * Render `cropPanel` in place of the drop zone while it is set.
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

    const cropPanel = pending && (
        <Suspense fallback={<s-spinner />}>
            <ImageCropPanel
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

    return { prepareImage, cropPanel };
}
