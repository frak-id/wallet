import { isValidUrl } from "@frak-labs/app-essentials";
import type { action } from "app/routes/app.appearance";
import type { MediaFile } from "app/services.server/backendMerchant";
import type {
    AppearanceMetafieldValue,
    I18nCustomizations,
} from "app/services.server/metafields";
import { isCustomizationsFormDirty } from "app/utils/formDirty";
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
import { LogoField } from "../Customizations/Field";

interface CustomizationsTabProps {
    initialCustomizations: I18nCustomizations;
    initialAppearanceMetafield: AppearanceMetafieldValue;
    mediaFiles?: MediaFile[];
    onDirtyChange?: (dirty: boolean) => void;
}

export function CustomizationsTab({
    initialCustomizations,
    initialAppearanceMetafield,
    mediaFiles,
    onDirtyChange,
}: CustomizationsTabProps) {
    const fetcher = useFetcher<typeof action>();
    const { t } = useTranslation();
    const saveBarId = useId();

    const [savedLogoUrl, setSavedLogoUrl] = useState(
        initialAppearanceMetafield.logoUrl || ""
    );
    const [logoUrl, setLogoUrl] = useState(savedLogoUrl);
    const [logoError, setLogoError] = useState<string | undefined>(undefined);

    // "Remove" only clears the pending reference; the Save action replays
    // the delete, skipping any type still referenced by saved settings.
    const [pendingDeletedTypes, setPendingDeletedTypes] = useState<string[]>(
        []
    );

    // Resolve a removed image URL to its stored media `type` via the loader
    // list, never by parsing the URL — external/manual URLs aren't in this
    // map, so removing them records no deletion.
    const mediaTypeByUrl = useMemo(
        () => new Map((mediaFiles ?? []).map((f) => [f.url, f.type])),
        [mediaFiles]
    );

    // Snapshot of the submitted logo, so success marks that as saved rather
    // than live `logoUrl` (which may have moved on mid-flight).
    const submittedLogoRef = useRef<string>("");

    const isSaving = fetcher.state !== "idle";
    const dirty = isCustomizationsFormDirty(logoUrl, savedLogoUrl);

    useEffect(() => {
        onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    // `hide()` rejects with "not found" when the bar isn't registered yet
    // (async custom-element upgrade races the initial hide) or is already
    // hidden — both benign, so swallow that rejection.
    useEffect(() => {
        if (dirty) {
            shopify.saveBar.show(saveBarId);
        } else {
            shopify.saveBar.hide(saveBarId).catch(() => {});
        }
    }, [dirty, saveBarId]);

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
        // surface an error toast.
        if (!fetcher.data.success) {
            if (message) shopify.toast.show(message, { isError: true });
            return;
        }
        if (message) shopify.toast.show(message);
        setSavedLogoUrl(submittedLogoRef.current);
        setPendingDeletedTypes([]);
    }, [fetcher.data]);

    const handleDiscard = useCallback(() => {
        setLogoUrl(savedLogoUrl);
        setPendingDeletedTypes([]);
        setLogoError(undefined);
    }, [savedLogoUrl]);

    const handleSave = useCallback(() => {
        // The Save Bar's Save button can't be conditionally disabled — gate
        // here and keep the bar open on an invalid logo URL (mirrors Explorer).
        if (logoUrl && !isValidUrl(logoUrl)) {
            setLogoError(t("common.invalidUrl"));
            shopify.toast.show(t("common.invalidUrlToast"), {
                isError: true,
            });
            return;
        }
        setLogoError(undefined);
        const newAppearance: AppearanceMetafieldValue = {
            ...initialAppearanceMetafield,
            logoUrl,
        };
        submittedLogoRef.current = logoUrl;
        fetcher.submit(
            {
                intent: "save",
                appearanceMetafield: JSON.stringify(newAppearance),
                customizations: JSON.stringify(initialCustomizations),
                deletedMediaTypes: JSON.stringify(pendingDeletedTypes),
            },
            { method: "post", action: "/app/appearance" }
        );
    }, [
        initialAppearanceMetafield,
        initialCustomizations,
        logoUrl,
        pendingDeletedTypes,
        fetcher,
        t,
    ]);

    const handleLogoRemove = useCallback(
        (previousUrl: string) => {
            // Only the logo type is deletable from this form; guard against a
            // stored hero URL pasted into the logo field recording a hero
            // deletion (which would delete an Explorer image on Save).
            if (mediaTypeByUrl.get(previousUrl) === "logo") {
                setPendingDeletedTypes((prev) => [...prev, "logo"]);
            }
        },
        [mediaTypeByUrl]
    );

    const handleLogoUpdate = useCallback((url: string) => {
        setLogoUrl(url);
        setLogoError(undefined);
    }, []);

    return (
        <>
            <ui-save-bar id={saveBarId} discardConfirmation>
                <button
                    type="button"
                    variant="primary"
                    loading={isSaving ? "" : undefined}
                    onClick={handleSave}
                >
                    {t("customizations.save")}
                </button>
                <button type="button" onClick={handleDiscard}>
                    {t("common.discard")}
                </button>
            </ui-save-bar>

            <s-stack gap="large">
                <LogoField
                    logoUrl={logoUrl}
                    onUpdate={handleLogoUpdate}
                    onUploadSuccess={handleLogoUpdate}
                    onRemove={handleLogoRemove}
                    mediaFiles={mediaFiles}
                    error={logoError}
                />
            </s-stack>
        </>
    );
}
