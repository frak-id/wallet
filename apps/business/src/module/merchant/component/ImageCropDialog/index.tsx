import {
    type CropSource,
    cropImageFile,
} from "@frak-labs/app-essentials/media/cropImage";
import {
    type ImageKind,
    maxCropZoom,
    ratioRangeLabels,
} from "@frak-labs/app-essentials/media/imageRatio";
import { Button } from "@frak-labs/design-system/components/Button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@frak-labs/design-system/components/Dialog";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { Text } from "@frak-labs/design-system/components/Text";
import { useId, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { useTranslation } from "react-i18next";
import * as styles from "./image-crop-dialog.css";

type ImageCropDialogProps = {
    request: CropSource;
    kind: ImageKind;
    /** `null` when the merchant cancels: the upload is dropped. */
    onSettle: (file: File | null) => void;
};

export function ImageCropDialog({
    request,
    kind,
    onSettle,
}: ImageCropDialogProps) {
    const { t } = useTranslation();
    const zoomId = useId();
    const [preset, setPreset] = useState(request.initial);
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [area, setArea] = useState<Area | null>(null);
    const [isCropping, setIsCropping] = useState(false);
    const [hasFailed, setHasFailed] = useState(false);
    const maxZoom = maxCropZoom(request.size, preset.value, kind);

    const selectPreset = (label: string) => {
        const next = request.presets.find((p) => p.label === label);
        if (!next) return;
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
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open && !isCropping) onSettle(null);
            }}
        >
            <DialogContent>
                <Stack space="m">
                    <Stack space="none">
                        <DialogTitle>
                            {t("merchantEdit.explorer.crop.title")}
                        </DialogTitle>
                        <DialogDescription>
                            {request.fits
                                ? t(
                                      "merchantEdit.explorer.crop.descriptionFits"
                                  )
                                : t(
                                      "merchantEdit.explorer.crop.description",
                                      ratioRangeLabels(kind)
                                  )}
                        </DialogDescription>
                    </Stack>
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
                    {request.presets.length > 1 && (
                        <Tabs value={preset.label} onValueChange={selectPreset}>
                            <TabsList
                                variant="segmented"
                                fullWidth
                                aria-label={t(
                                    "merchantEdit.explorer.crop.ratio"
                                )}
                            >
                                {request.presets.map((option) => (
                                    <TabsTrigger
                                        key={option.label}
                                        value={option.label}
                                        variant="segmented"
                                        fullWidth
                                    >
                                        {option.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    )}
                    {maxZoom > 1 && (
                        <Stack space="xxs">
                            <Text
                                as="label"
                                htmlFor={zoomId}
                                variant="bodySmall"
                                weight="medium"
                                color="secondary"
                            >
                                {t("merchantEdit.explorer.crop.zoom")}
                            </Text>
                            <input
                                id={zoomId}
                                type="range"
                                className={styles.zoomSlider}
                                min={1}
                                max={maxZoom}
                                step={0.01}
                                value={zoom}
                                onChange={(e) =>
                                    setZoom(Number(e.target.value))
                                }
                            />
                        </Stack>
                    )}
                    {hasFailed && (
                        <Text variant="caption" color="error">
                            {t("merchantEdit.explorer.crop.failed")}
                        </Text>
                    )}
                    <Inline space="s" fill wrap={false}>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={isCropping}
                            onClick={() => onSettle(null)}
                        >
                            {t("merchantEdit.explorer.crop.cancel")}
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            loading={isCropping}
                            disabled={!area || isCropping}
                            onClick={confirm}
                        >
                            {t("merchantEdit.explorer.crop.confirm")}
                        </Button>
                    </Inline>
                    {request.fits && (
                        <Inline space="none" align="center">
                            <Button
                                type="button"
                                variant="ghost"
                                size="small"
                                width="auto"
                                disabled={isCropping}
                                onClick={() => onSettle(request.file)}
                            >
                                {t("merchantEdit.explorer.crop.useAsIs")}
                            </Button>
                        </Inline>
                    )}
                </Stack>
            </DialogContent>
        </Dialog>
    );
}
