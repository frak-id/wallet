import { ExplorerPhonePreview, previewWrap } from "@frak-labs/ui-preview";
import type { action } from "app/routes/app.appearance";
import type {
    ExplorerSettings,
    MediaFile,
} from "app/services.server/backendMerchant";
import { isExplorerFormDirty, validateExplorerSave } from "app/utils/formDirty";
import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";
import * as styles from "./ExplorerTab.css";
import { ImageUploadField } from "./ImageUploadField";
import { MultiHeroImagesField } from "./MultiHeroImagesField";

type ExplorerTabProps = {
    initialExplorerSettings: ExplorerSettings | null;
    shopName: string;
    mediaFiles?: MediaFile[];
    onDirtyChange?: (dirty: boolean) => void;
};

export function ExplorerTab({
    initialExplorerSettings,
    shopName,
    mediaFiles,
    onDirtyChange,
}: ExplorerTabProps) {
    const fetcher = useFetcher<typeof action>();
    const { t } = useTranslation();
    const saveBarId = useId();

    // No fallback chain (matches the business app): the fields reflect only
    // the explicitly-saved explorer config, so a cleared logo/hero stays
    // genuinely empty on reload instead of silently re-deriving the app/brand
    // logo. `?? ""` is just the unset-→empty default for the controlled input.
    const defaults = useMemo(
        () => ({
            enabled: initialExplorerSettings?.enabled ?? false,
            logoUrl: initialExplorerSettings?.logoUrl ?? "",
            heroImageUrl: initialExplorerSettings?.heroImageUrl ?? "",
            heroImageUrls: initialExplorerSettings?.heroImageUrls ?? [],
            description: initialExplorerSettings?.description ?? "",
        }),
        [initialExplorerSettings]
    );

    // "saved" mirrors the last committed state, "pending" mirrors what's on
    // screen. Save Bar shows when they differ; Discard resets pending.
    const [saved, setSaved] = useState(defaults);
    const [enabled, setEnabled] = useState(defaults.enabled);
    const [logoUrl, setLogoUrl] = useState(defaults.logoUrl);
    const [heroImageUrl, setHeroImageUrl] = useState(defaults.heroImageUrl);
    const [heroImageUrls, setHeroImageUrls] = useState(defaults.heroImageUrls);
    const [description, setDescription] = useState(defaults.description);

    // "Remove" only clears the pending reference; the Save action replays
    // the delete, skipping any type still referenced by saved settings.
    const [pendingDeletedTypes, setPendingDeletedTypes] = useState<string[]>(
        []
    );

    // Resolve a removed image URL to its stored media `type` via the
    // authoritative loader list, never by parsing the URL. External or
    // manually pasted URLs aren't in this map, so removing them records no
    // deletion (avoids deleting files we don't own or firing bogus deletes).
    const mediaTypeByUrl = useMemo(
        () => new Map((mediaFiles ?? []).map((f) => [f.url, f.type])),
        [mediaFiles]
    );

    // Snapshot of exactly what was submitted, so the success handler marks
    // that snapshot as saved rather than live `pending` (which may have moved
    // on mid-flight or had invalid URLs dropped at submit).
    const submittedRef = useRef<ExplorerSettings | null>(null);

    const [urlFieldError, setUrlFieldError] = useState<{
        logo?: string;
        hero?: string;
    }>({});

    const isSaving = fetcher.state !== "idle";

    const pending: ExplorerSettings = useMemo(
        () => ({
            enabled,
            logoUrl,
            heroImageUrl,
            heroImageUrls,
            description,
        }),
        [enabled, logoUrl, heroImageUrl, heroImageUrls, description]
    );

    const dirty = isExplorerFormDirty(pending, saved);

    useEffect(() => {
        onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    // Drive the native contextual Save Bar from local dirty state. `hide()`
    // rejects with "not found" when the bar isn't registered yet (custom
    // element upgrade is async, so the initial hide races mount) or is already
    // hidden — both benign, so swallow that rejection.
    useEffect(() => {
        if (dirty) {
            shopify.saveBar.show(saveBarId);
        } else {
            shopify.saveBar.hide(saveBarId).catch(() => {});
        }
    }, [dirty, saveBarId]);

    // Hide the save bar on unmount so it can't go stale (e.g. switching away
    // from this tab).
    useEffect(() => {
        return () => {
            shopify.saveBar.hide(saveBarId).catch(() => {});
        };
    }, [saveBarId]);

    useEffect(() => {
        if (!fetcher.data) return;
        const message =
            "message" in fetcher.data &&
            typeof fetcher.data.message === "string"
                ? fetcher.data.message
                : null;
        // On failure keep pending state intact (the save bar stays open) and
        // surface an error toast (Risks: Save-time partial failure).
        if (!fetcher.data.success) {
            if (message) shopify.toast.show(message, { isError: true });
            return;
        }
        if (message) shopify.toast.show(message);
        // Mark the exact submitted snapshot as saved — not live `pending`,
        // which may have moved on if the merchant edited mid-flight or if
        // validation dropped invalid URLs before submit.
        if (submittedRef.current) setSaved(submittedRef.current);
        setPendingDeletedTypes([]);
    }, [fetcher.data]);

    const handleDiscard = useCallback(() => {
        setEnabled(saved.enabled);
        setLogoUrl(saved.logoUrl);
        setHeroImageUrl(saved.heroImageUrl);
        setHeroImageUrls(saved.heroImageUrls);
        setDescription(saved.description);
        setPendingDeletedTypes([]);
        setUrlFieldError({});
    }, [saved]);

    const handleSave = useCallback(() => {
        // The Save Bar's Save button can't be conditionally disabled like an
        // inline button — validate here and keep the bar open on failure.
        const validation = validateExplorerSave(pending);
        if (!validation.canSave) {
            setUrlFieldError({
                logo: validation.logoError ? t("common.invalidUrl") : undefined,
                hero: validation.heroError ? t("common.invalidUrl") : undefined,
            });
            shopify.toast.show(t("common.invalidUrlToast"), {
                isError: true,
            });
            return;
        }

        setUrlFieldError({});
        submittedRef.current = validation.settingsToSave;
        fetcher.submit(
            {
                intent: "saveExplorer",
                explorerSettings: JSON.stringify(validation.settingsToSave),
                deletedMediaTypes: JSON.stringify(pendingDeletedTypes),
            },
            { method: "post", action: "/app/appearance" }
        );
    }, [pending, pendingDeletedTypes, fetcher, t]);

    const handleLogoChange = useCallback((url: string) => {
        setLogoUrl(url);
        setUrlFieldError((prev) => ({ ...prev, logo: undefined }));
    }, []);

    const handleMediaRemove = useCallback(
        (previousUrl: string) => {
            const removedType = mediaTypeByUrl.get(previousUrl);
            if (removedType) {
                setPendingDeletedTypes((prev) => [...prev, removedType]);
            }
        },
        [mediaTypeByUrl]
    );

    const handleHeroChange = useCallback((url: string) => {
        setHeroImageUrl(url);
        setUrlFieldError((prev) => ({ ...prev, hero: undefined }));
    }, []);

    const handleHeroExtrasChange = useCallback(
        (next: string[]) => {
            const removed = heroImageUrls.filter((url) => !next.includes(url));
            const added = next.filter((url) => !heroImageUrls.includes(url));
            for (const url of removed) {
                const removedType = mediaTypeByUrl.get(url);
                if (removedType) {
                    setPendingDeletedTypes((prev) => [...prev, removedType]);
                }
            }
            // Re-adding a previously-removed image (via the existing-file
            // picker) cancels its pending deletion so the still-stored file
            // isn't deleted on Save. This does not cover re-uploading the same
            // file through the dropzone — that 409s at upload time, before the
            // URL reaches this handler.
            for (const url of added) {
                const readdedType = mediaTypeByUrl.get(url);
                if (readdedType) {
                    setPendingDeletedTypes((prev) =>
                        prev.filter((type) => type !== readdedType)
                    );
                }
            }
            setHeroImageUrls(next);
        },
        [heroImageUrls, mediaTypeByUrl]
    );

    return (
        <>
            <ui-save-bar id={saveBarId} discardConfirmation>
                <button
                    type="button"
                    variant="primary"
                    loading={isSaving ? "" : undefined}
                    onClick={handleSave}
                >
                    {t("appearance.explorer.save")}
                </button>
                <button type="button" onClick={handleDiscard}>
                    {t("common.discard")}
                </button>
            </ui-save-bar>

            <div className={styles.form}>
                <div className={styles.formCol}>
                    <s-section>
                        <s-stack gap="large">
                            <s-text>
                                {t("appearance.explorer.description")}
                            </s-text>

                            <s-switch
                                label={t("appearance.explorer.enabledLabel")}
                                details={t("appearance.explorer.enabledHint")}
                                checked={enabled || undefined}
                                onChange={(e) => {
                                    setEnabled(
                                        e.currentTarget.checked ?? false
                                    );
                                }}
                            />

                            <ImageUploadField
                                type="logo"
                                value={logoUrl}
                                onChange={handleLogoChange}
                                onUploadSuccess={handleLogoChange}
                                onRemove={handleMediaRemove}
                                label={t("appearance.explorer.logoLabel")}
                                mediaFiles={mediaFiles}
                                error={urlFieldError.logo}
                            />

                            <ImageUploadField
                                type="hero"
                                value={heroImageUrl}
                                onChange={handleHeroChange}
                                onUploadSuccess={handleHeroChange}
                                onRemove={handleMediaRemove}
                                label={t("appearance.explorer.heroLabel")}
                                mediaFiles={mediaFiles}
                                error={urlFieldError.hero}
                            />

                            <MultiHeroImagesField
                                label={t("appearance.explorer.heroExtrasLabel")}
                                values={heroImageUrls}
                                onChange={handleHeroExtrasChange}
                            />

                            <s-text-area
                                label={t(
                                    "appearance.explorer.descriptionLabel"
                                )}
                                placeholder={t(
                                    "appearance.explorer.descriptionPlaceholder"
                                )}
                                value={description}
                                onChange={(e) =>
                                    setDescription(e.currentTarget.value ?? "")
                                }
                                autocomplete="off"
                            />
                        </s-stack>
                    </s-section>
                </div>

                {/* Phone preview column — a flex sibling of the form so
                    Polaris re-centring can't make it overlap the card.
                    Dimmed + shrunk while the listing is disabled. */}
                <div className={styles.preview}>
                    <div
                        className={previewWrap}
                        data-disabled={enabled ? undefined : ""}
                    >
                        <ExplorerPhonePreview
                            name={shopName}
                            heroImageUrl={heroImageUrl || undefined}
                            heroImageUrls={heroImageUrls}
                            logoUrl={logoUrl || undefined}
                            description={description || undefined}
                        />
                    </div>
                    {!enabled && (
                        <div className={styles.previewHint}>
                            <s-icon
                                type="info"
                                color="subdued"
                                interestFor="explorer-preview-disabled-tip"
                            />
                            <s-text
                                color="subdued"
                                interestFor="explorer-preview-disabled-tip"
                            >
                                {t("appearance.explorer.previewDisabledLabel")}
                            </s-text>
                            <s-tooltip id="explorer-preview-disabled-tip">
                                {t("appearance.explorer.previewDisabledHint")}
                            </s-tooltip>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
