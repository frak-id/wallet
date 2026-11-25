import {
    type CropSource,
    cropImageFile,
} from "@frak-labs/app-essentials/media/cropImage";
import {
    type ImageKind,
    maxCropZoom,
    type RatioPreset,
    ratioRangeLabels,
} from "@frak-labs/app-essentials/media/imageRatio";
import { useId, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { useTranslation } from "react-i18next";
import * as styles from "./image-crop-panel.css";

type ImageCropPanelProps = {
    request: CropSource;
    kind: ImageKind;
    /** `null` when the merchant cancels: the upload is dropped. */
    onSettle: (file: File | null) => void;
};

/** Inline, not an `s-modal`: the admin can host modal content outside this frame, away from the cropper's styles. */
export function ImageCropPanel({
    request,
    kind,
    onSettle,
}: ImageCropPanelProps) {
    const { t } = useTranslation();
    const zoomId = useId();
    const [preset, setPreset] = useState(request.initial);
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [area, setArea] = useState<Area | null>(null);
    const [isCropping, setIsCropping] = useState(false);
    const [hasFailed, setHasFailed] = useState(false);
    const maxZoom = maxCropZoom(request.size, preset.value, kind);

    const selectPreset = (next: RatioPreset) => {
        setPreset(next);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
    };

    const confirm = async () => {
        if (!area) return;
        setIsCropping(true);
        setHasFailed(false);
        try {
            onSettle(
                await cropImageFile({
                    source: request,
                    area,
                    aspect: preset.value,
                    kind,
                })
            );
        } catch {
            setHasFailed(true);
            setIsCropping(false);
        }
    };

    return (
        <s-box border="base" borderRadius="base" padding="base">
            <s-stack gap="base">
                <s-stack gap="small-300">
                    <s-heading>{t("appearance.upload.crop.title")}</s-heading>
                    <s-text color="subdued">
                        {request.fits
                            ? t("appearance.upload.crop.descriptionFits")
                            : t(
                                  "appearance.upload.crop.description",
                                  ratioRangeLabels(kind)
                              )}
                    </s-text>
                </s-stack>
                <s-box background="subdued" borderRadius="base">
                    <div className={styles.cropArea}>
                        <Cropper
                            image={request.src}
                            crop={crop}
                            zoom={zoom}
                            maxZoom={maxZoom}
                            aspect={preset.value}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={(_, pixels) => setArea(pixels)}
                        />
                    </div>
                </s-box>
                {request.presets.length > 1 && (
                    <s-stack
                        direction="inline"
                        gap="small-200"
                        alignItems="center"
                    >
                        <s-text>{t("appearance.upload.crop.ratio")}</s-text>
                        {request.presets.map((option) => (
                            <s-press-button
                                key={option.label}
                                pressed={option.label === preset.label}
                                onClick={() => selectPreset(option)}
                            >
                                {option.label}
                            </s-press-button>
                        ))}
                    </s-stack>
                )}
                {maxZoom > 1 && (
                    <s-stack gap="small-300">
                        <label htmlFor={zoomId}>
                            <s-text>{t("appearance.upload.crop.zoom")}</s-text>
                        </label>
                        <input
                            id={zoomId}
                            type="range"
                            className={styles.zoomSlider}
                            min={1}
                            max={maxZoom}
                            step={0.01}
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                        />
                    </s-stack>
                )}
                {hasFailed && (
                    <s-text tone="critical">
                        {t("appearance.upload.crop.failed")}
                    </s-text>
                )}
                <s-stack direction="inline" gap="small" justifyContent="end">
                    {request.fits && (
                        <s-button
                            variant="tertiary"
                            disabled={isCropping || undefined}
                            onClick={() => onSettle(request.file)}
                        >
                            {t("appearance.upload.crop.useAsIs")}
                        </s-button>
                    )}
                    <s-button
                        disabled={isCropping || undefined}
                        onClick={() => onSettle(null)}
                    >
                        {t("appearance.upload.crop.cancel")}
                    </s-button>
                    <s-button
                        variant="primary"
                        loading={isCropping || undefined}
                        disabled={!area || isCropping || undefined}
                        onClick={confirm}
                    >
                        {t("appearance.upload.crop.confirm")}
                    </s-button>
                </s-stack>
            </s-stack>
        </s-box>
    );
}
