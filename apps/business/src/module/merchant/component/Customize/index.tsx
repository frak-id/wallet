import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { Button } from "@frak-labs/ui/component/Button";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Panel } from "@/module/common/component/Panel";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormLayout,
    FormMessage,
} from "@/module/forms/Form";
import { FormActions } from "@/module/forms/FormActions";
import { Switch } from "@/module/forms/Switch";
import { MerchantHead } from "@/module/merchant/component/MerchantHead";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { useSdkConfig } from "@/module/merchant/hook/useSdkConfig";
import styles from "./index.module.css";

type TranslationLang = "default" | "en" | "fr";

type TranslationFormValues = {
    translationsDefault: Record<string, string>;
    translationsEn: Record<string, string>;
    translationsFr: Record<string, string>;
};

type SdkIdentityFormValues = {
    name: string;
    logoUrl: string;
    homepageLink: string;
    currency: "" | "eur" | "usd" | "gbp";
    lang: "" | "en" | "fr";
};

type CssFormValues = {
    css: string;
};

type PlacementSettingsFormValues = {
    triggerText: string;
    triggerNoRewardText: string;
    triggerPosition: "bottom-right" | "bottom-left";
    triggerShowWallet: boolean;
    targetInteraction: string;
};

const TRANSLATION_GROUPS = {
    "modal.dismiss": [
        "sdk.modal.dismiss.primaryAction",
        "sdk.modal.dismiss.primaryAction_sharing",
    ],
    "modal.final": [
        "sdk.modal.final.title",
        "sdk.modal.final.title_reward",
        "sdk.modal.final.title_sharing",
        "sdk.modal.final.description",
        "sdk.modal.final.description_sharing",
        "sdk.modal.final.description_reward",
        "sdk.modal.final.dismissed.description",
        "sdk.modal.final.dismissed.description_sharing",
    ],
    "modal.login": [
        "sdk.modal.login.description",
        "sdk.modal.login.description_sharing",
        "sdk.modal.login.description_reward",
        "sdk.modal.login.primaryAction",
        "sdk.modal.login.secondaryAction",
        "sdk.modal.login.title",
        "sdk.modal.login.success",
    ],
    "modal.sendTransaction": [
        "sdk.modal.sendTransaction.description",
        "sdk.modal.sendTransaction.primaryAction_one",
        "sdk.modal.sendTransaction.primaryAction_other",
        "sdk.modal.sendTransaction.title",
    ],
    "modal.siweAuthenticate": [
        "sdk.modal.siweAuthenticate.description",
        "sdk.modal.siweAuthenticate.primaryAction",
        "sdk.modal.siweAuthenticate.title",
    ],
    "wallet.login": [
        "sdk.wallet.login.text",
        "sdk.wallet.login.text_referred",
        "sdk.wallet.login.primaryAction",
    ],
    "wallet.loggedIn": [
        "sdk.wallet.loggedIn.onboarding.welcome",
        "sdk.wallet.loggedIn.onboarding.share",
        "sdk.wallet.loggedIn.onboarding.share_referred",
    ],
} as const;

const TRANSLATION_LANG_FIELDS = {
    default: "translationsDefault",
    en: "translationsEn",
    fr: "translationsFr",
} as const;

function valueOrNull(value: string): string | null {
    return value.trim() === "" ? null : value;
}

function valueOrUndefined(value: string): string | undefined {
    return value.trim() === "" ? undefined : value;
}

function normalizeTranslationsRecord(values: Record<string, string>) {
    return Object.fromEntries(
        Object.entries(values).filter(
            ([, value]) => value && value.trim() !== ""
        )
    );
}

function getSdkConfig(sdkConfig: SdkConfig | null | undefined): SdkConfig {
    return sdkConfig ?? {};
}

function getTranslationsFormValues(
    translations: SdkConfig["translations"] | undefined | null
): TranslationFormValues {
    return {
        translationsDefault: translations?.default ?? {},
        translationsEn: translations?.en ?? {},
        translationsFr: translations?.fr ?? {},
    };
}

function getPlacementTranslationsFormValues(
    sdkConfig: SdkConfig,
    placementId: string
): TranslationFormValues {
    const placement = sdkConfig.placements?.[placementId];
    return {
        translationsDefault: placement?.translations?.default ?? {},
        translationsEn: placement?.translations?.en ?? {},
        translationsFr: placement?.translations?.fr ?? {},
    };
}

function buildTranslationsPayload(values: TranslationFormValues) {
    const defaultValues = normalizeTranslationsRecord(
        values.translationsDefault
    );
    const enValues = normalizeTranslationsRecord(values.translationsEn);
    const frValues = normalizeTranslationsRecord(values.translationsFr);

    const hasAnyValues =
        Object.keys(defaultValues).length > 0 ||
        Object.keys(enValues).length > 0 ||
        Object.keys(frValues).length > 0;

    return {
        translations: {
            default: defaultValues,
            en: enValues,
            fr: frValues,
        },
        hasAnyValues,
    };
}

function updatePlacement(
    sdkConfig: SdkConfig,
    placementId: string,
    update: (
        placement: NonNullable<NonNullable<SdkConfig["placements"]>[string]>
    ) => NonNullable<NonNullable<SdkConfig["placements"]>[string]>
) {
    const currentPlacements = sdkConfig.placements ?? {};
    const currentPlacement = currentPlacements[placementId] ?? {};

    return {
        ...currentPlacements,
        [placementId]: update(currentPlacement),
    };
}

export function CustomizePage({ merchantId }: { merchantId: string }) {
    const { data: sdkConfigData } = useSdkConfig({ merchantId });
    const sdkConfig = useMemo(
        () => getSdkConfig(sdkConfigData?.sdkConfig),
        [sdkConfigData]
    );

    const placements = sdkConfig.placements ?? {};
    const placementIds = Object.keys(placements);

    const [activeTab, setActiveTab] = useState<"default" | string>("default");
    const [dirtySections, setDirtySections] = useState<Record<string, boolean>>(
        {}
    );

    const {
        mutateAsync: createPlacement,
        isPending: isCreatingPlacement,
        isSuccess: isCreatePlacementSuccess,
    } = useMerchantUpdate({ merchantId, target: "sdk-config" });

    const onDirtyChange = useCallback((key: string, isDirty: boolean) => {
        setDirtySections((prevState) => {
            if (prevState[key] === isDirty) {
                return prevState;
            }

            return {
                ...prevState,
                [key]: isDirty,
            };
        });
    }, []);

    const hasUnsavedChanges = useMemo(
        () => Object.values(dirtySections).some(Boolean),
        [dirtySections]
    );

    const handleTabChange = useCallback(
        (nextTab: "default" | string) => {
            if (nextTab === activeTab) return;

            if (
                hasUnsavedChanges &&
                !window.confirm(
                    "You have unsaved changes. Switch tab and discard local edits?"
                )
            ) {
                return;
            }

            setDirtySections({});
            setActiveTab(nextTab);
        },
        [activeTab, hasUnsavedChanges]
    );

    const handleCreatePlacement = useCallback(
        async (placementId: string) => {
            const currentPlacements = sdkConfig.placements ?? {};
            await createPlacement({
                placements: {
                    ...currentPlacements,
                    [placementId]: {},
                },
            });
            setDirtySections({});
            setActiveTab(placementId);
        },
        [createPlacement, sdkConfig.placements]
    );

    if (!sdkConfigData) return null;

    return (
        <FormLayout>
            <MerchantHead merchantId={merchantId} />

            <SdkIdentityPanel
                merchantId={merchantId}
                sdkConfig={sdkConfig}
                onDirtyChange={onDirtyChange}
            />

            <CustomizationTabs
                activeTab={activeTab}
                placementIds={placementIds}
                onTabChange={handleTabChange}
                onCreatePlacement={handleCreatePlacement}
                isCreatingPlacement={isCreatingPlacement}
                isCreatePlacementSuccess={isCreatePlacementSuccess}
            />

            {activeTab === "default" ? (
                <DefaultCustomization
                    merchantId={merchantId}
                    sdkConfig={sdkConfig}
                    onDirtyChange={onDirtyChange}
                />
            ) : (
                <PlacementCustomization
                    merchantId={merchantId}
                    placementId={activeTab}
                    sdkConfig={sdkConfig}
                    onDirtyChange={onDirtyChange}
                    onSelectDefaultTab={() => handleTabChange("default")}
                />
            )}
        </FormLayout>
    );
}

function SdkIdentityPanel({
    merchantId,
    sdkConfig,
    onDirtyChange,
}: {
    merchantId: string;
    sdkConfig: SdkConfig;
    onDirtyChange: (key: string, isDirty: boolean) => void;
}) {
    const {
        mutate: editSdkConfig,
        isPending: isPendingUpdate,
        isSuccess: isSuccessUpdate,
    } = useMerchantUpdate({ merchantId, target: "sdk-config" });

    const values = useMemo<SdkIdentityFormValues>(
        () => ({
            name: sdkConfig.name ?? "",
            logoUrl: sdkConfig.logoUrl ?? "",
            homepageLink: sdkConfig.homepageLink ?? "",
            currency: sdkConfig.currency ?? "",
            lang: sdkConfig.lang ?? "",
        }),
        [sdkConfig]
    );

    const form = useForm<SdkIdentityFormValues>({
        values,
        defaultValues: {
            name: "",
            logoUrl: "",
            homepageLink: "",
            currency: "",
            lang: "",
        },
    });

    useEffect(() => {
        onDirtyChange("identity", form.formState.isDirty);
        return () => onDirtyChange("identity", false);
    }, [form.formState.isDirty, onDirtyChange]);

    useEffect(() => {
        if (!isSuccessUpdate) return;
        form.reset(form.getValues());
    }, [isSuccessUpdate, form.reset, form.getValues, form]);

    const onSubmit = useCallback(
        (currentValues: SdkIdentityFormValues) => {
            editSdkConfig({
                name: valueOrNull(currentValues.name),
                logoUrl: valueOrNull(currentValues.logoUrl),
                homepageLink: valueOrNull(currentValues.homepageLink),
                currency: currentValues.currency || null,
                lang: currentValues.lang || null,
            });
        },
        [editSdkConfig]
    );

    return (
        <Form {...form}>
            <Panel title={"SDK Identity"}>
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>Name</FormLabel>
                            <FormControl>
                                <Input
                                    length={"medium"}
                                    placeholder={"Merchant Name"}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="logoUrl"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>Logo URL</FormLabel>
                            <FormControl>
                                <Input
                                    length={"medium"}
                                    placeholder={"https://..."}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="homepageLink"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>
                                Homepage Link
                            </FormLabel>
                            <FormControl>
                                <Input
                                    length={"medium"}
                                    placeholder={"https://..."}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>Currency</FormLabel>
                            <FormControl>
                                <select
                                    className={styles.customize__select}
                                    {...field}
                                >
                                    <option value="">Auto</option>
                                    <option value="eur">EUR</option>
                                    <option value="usd">USD</option>
                                    <option value="gbp">GBP</option>
                                </select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="lang"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>Language</FormLabel>
                            <FormControl>
                                <select
                                    className={styles.customize__select}
                                    {...field}
                                >
                                    <option value="">
                                        Auto (Browser detection)
                                    </option>
                                    <option value="en">English</option>
                                    <option value="fr">French</option>
                                </select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormActions
                    isSuccess={isSuccessUpdate}
                    isPending={isPendingUpdate}
                    isDirty={form.formState.isDirty}
                    onDiscard={() => form.reset(values)}
                    onSubmit={() => form.handleSubmit(onSubmit)()}
                />
            </Panel>
        </Form>
    );
}

function CustomizationTabs({
    activeTab,
    placementIds,
    onTabChange,
    onCreatePlacement,
    isCreatingPlacement,
    isCreatePlacementSuccess,
}: {
    activeTab: "default" | string;
    placementIds: string[];
    onTabChange: (tab: "default" | string) => void;
    onCreatePlacement: (placementId: string) => Promise<void>;
    isCreatingPlacement: boolean;
    isCreatePlacementSuccess: boolean;
}) {
    const visiblePlacements = placementIds.slice(0, 4);
    const overflowPlacements = placementIds.slice(4);
    const [isOverflowOpen, setIsOverflowOpen] = useState(false);

    useEffect(() => {
        if (!isOverflowOpen) return;
        setIsOverflowOpen(false);
    }, [activeTab]);

    return (
        <Panel title={"SDK Customization"}>
            <div className={styles.customize__tabs}>
                <button
                    type="button"
                    className={`${styles.customize__tab} ${
                        activeTab === "default"
                            ? styles["customize__tab--active"]
                            : ""
                    }`}
                    onClick={() => onTabChange("default")}
                >
                    Global defaults
                </button>

                {visiblePlacements.map((placementId) => (
                    <button
                        key={placementId}
                        type="button"
                        className={`${styles.customize__tab} ${
                            activeTab === placementId
                                ? styles["customize__tab--active"]
                                : ""
                        }`}
                        onClick={() => onTabChange(placementId)}
                    >
                        {placementId}
                    </button>
                ))}

                {overflowPlacements.length > 0 && (
                    <div className={styles.customize__overflow}>
                        <button
                            type="button"
                            className={styles.customize__tab}
                            onClick={() => setIsOverflowOpen(!isOverflowOpen)}
                            aria-expanded={isOverflowOpen}
                        >
                            ...
                        </button>
                        {isOverflowOpen && (
                            <div className={styles.customize__overflowMenu}>
                                {overflowPlacements.map((placementId) => (
                                    <button
                                        key={placementId}
                                        type="button"
                                        className={
                                            styles.customize__overflowItem
                                        }
                                        onClick={() => onTabChange(placementId)}
                                    >
                                        {placementId}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <CreatePlacementButton
                    placementIds={placementIds}
                    onCreatePlacement={onCreatePlacement}
                    isCreatingPlacement={isCreatingPlacement}
                    isCreatePlacementSuccess={isCreatePlacementSuccess}
                />
            </div>
        </Panel>
    );
}

function CreatePlacementButton({
    placementIds,
    onCreatePlacement,
    isCreatingPlacement,
    isCreatePlacementSuccess,
}: {
    placementIds: string[];
    onCreatePlacement: (placementId: string) => Promise<void>;
    isCreatingPlacement: boolean;
    isCreatePlacementSuccess: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [newPlacementId, setNewPlacementId] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isCreatePlacementSuccess || !open) return;
        setOpen(false);
    }, [isCreatePlacementSuccess, open]);

    function validatePlacementId(value: string) {
        const placementId = value.trim();

        if (placementIds.length >= 10) {
            return "Maximum 10 placements allowed.";
        }

        if (!/^[a-zA-Z0-9_-]{3,16}$/.test(placementId)) {
            return "Use 3-16 chars (letters, numbers, _ or -).";
        }

        if (placementIds.includes(placementId)) {
            return "This placement already exists.";
        }

        return null;
    }

    async function handleCreate() {
        const validationError = validatePlacementId(newPlacementId);
        if (validationError) {
            setError(validationError);
            return;
        }

        setError(null);
        await onCreatePlacement(newPlacementId.trim());
        setNewPlacementId("");
    }

    return (
        <AlertDialog
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                    setError(null);
                    setNewPlacementId("");
                }
            }}
            title={"Create placement"}
            buttonElement={
                <button
                    type="button"
                    className={styles.customize__tabAdd}
                    disabled={placementIds.length >= 10}
                    title={
                        placementIds.length >= 10
                            ? "Maximum 10 placements reached"
                            : "Create a new placement"
                    }
                >
                    <Plus size={16} />
                </button>
            }
            description={
                <div className={styles.customize__createDialogBody}>
                    <p className={styles.customize__hint}>
                        Placement id must be unique and use 3 to 16 characters.
                    </p>
                    <Input
                        length={"big"}
                        value={newPlacementId}
                        onChange={(event) => {
                            setNewPlacementId(event.target.value);
                            setError(null);
                        }}
                        placeholder={"homepage_banner"}
                        maxLength={16}
                    />
                    {error && <p className={"error"}>{error}</p>}
                </div>
            }
            cancel={<Button variant={"outline"}>Cancel</Button>}
            action={
                <Button
                    variant={"submit"}
                    onClick={handleCreate}
                    isLoading={isCreatingPlacement}
                    disabled={isCreatingPlacement}
                >
                    Create placement
                </Button>
            }
        />
    );
}

function DefaultCustomization({
    merchantId,
    sdkConfig,
    onDirtyChange,
}: {
    merchantId: string;
    sdkConfig: SdkConfig;
    onDirtyChange: (key: string, isDirty: boolean) => void;
}) {
    return (
        <>
            <GlobalCssPanel
                merchantId={merchantId}
                sdkConfig={sdkConfig}
                onDirtyChange={onDirtyChange}
            />
            <GlobalTranslationsPanel
                merchantId={merchantId}
                sdkConfig={sdkConfig}
                onDirtyChange={onDirtyChange}
            />
        </>
    );
}

function GlobalCssPanel({
    merchantId,
    sdkConfig,
    onDirtyChange,
}: {
    merchantId: string;
    sdkConfig: SdkConfig;
    onDirtyChange: (key: string, isDirty: boolean) => void;
}) {
    const {
        mutate: editSdkConfig,
        isPending,
        isSuccess,
    } = useMerchantUpdate({ merchantId, target: "sdk-config" });

    const values = useMemo<CssFormValues>(
        () => ({
            css: sdkConfig.css ?? "",
        }),
        [sdkConfig.css]
    );

    const form = useForm<CssFormValues>({
        values,
        defaultValues: {
            css: "",
        },
    });

    useEffect(() => {
        onDirtyChange("default-css", form.formState.isDirty);
        return () => onDirtyChange("default-css", false);
    }, [form.formState.isDirty, onDirtyChange]);

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    return (
        <Panel title={"Global CSS"}>
            <CssEditor
                value={form.watch("css")}
                onChange={(value) => {
                    form.setValue("css", value, { shouldDirty: true });
                }}
                placeholder={".frak-modal { ... }"}
                isPending={isPending}
                isSuccess={isSuccess}
                isDirty={form.formState.isDirty}
                onDiscard={() => form.reset(values)}
                onSave={() =>
                    editSdkConfig({
                        css: valueOrNull(form.getValues("css")),
                    })
                }
            />
        </Panel>
    );
}

function GlobalTranslationsPanel({
    merchantId,
    sdkConfig,
    onDirtyChange,
}: {
    merchantId: string;
    sdkConfig: SdkConfig;
    onDirtyChange: (key: string, isDirty: boolean) => void;
}) {
    const {
        mutate: editSdkConfig,
        isPending,
        isSuccess,
    } = useMerchantUpdate({ merchantId, target: "sdk-config" });
    const [lang, setLang] = useState<TranslationLang>("default");

    const values = useMemo<TranslationFormValues>(
        () => getTranslationsFormValues(sdkConfig.translations),
        [sdkConfig.translations]
    );

    const form = useForm<TranslationFormValues>({
        values,
        defaultValues: {
            translationsDefault: {},
            translationsEn: {},
            translationsFr: {},
        },
    });

    useEffect(() => {
        onDirtyChange("default-translations", form.formState.isDirty);
        return () => onDirtyChange("default-translations", false);
    }, [form.formState.isDirty, onDirtyChange]);

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    return (
        <Form {...form}>
            <Panel title={"Global translations"}>
                <TranslationEditor
                    form={form}
                    fieldPrefix={"translations"}
                    lang={lang}
                    onLangChange={setLang}
                />
                <FormActions
                    isSuccess={isSuccess}
                    isPending={isPending}
                    isDirty={form.formState.isDirty}
                    onDiscard={() => form.reset(values)}
                    onSubmit={() => {
                        const payload = buildTranslationsPayload(
                            form.getValues()
                        );
                        editSdkConfig({
                            translations: payload.hasAnyValues
                                ? payload.translations
                                : null,
                        });
                    }}
                />
            </Panel>
        </Form>
    );
}

function PlacementCustomization({
    merchantId,
    placementId,
    sdkConfig,
    onDirtyChange,
    onSelectDefaultTab,
}: {
    merchantId: string;
    placementId: string;
    sdkConfig: SdkConfig;
    onDirtyChange: (key: string, isDirty: boolean) => void;
    onSelectDefaultTab: () => void;
}) {
    const placement = sdkConfig.placements?.[placementId];

    if (!placement) return null;

    return (
        <>
            <PlacementSettingsPanel
                merchantId={merchantId}
                placementId={placementId}
                sdkConfig={sdkConfig}
                onDirtyChange={onDirtyChange}
            />
            <PlacementCssPanel
                merchantId={merchantId}
                placementId={placementId}
                sdkConfig={sdkConfig}
                onDirtyChange={onDirtyChange}
            />
            <PlacementTranslationsPanel
                merchantId={merchantId}
                placementId={placementId}
                sdkConfig={sdkConfig}
                onDirtyChange={onDirtyChange}
            />
            <DeletePlacementPanel
                merchantId={merchantId}
                placementId={placementId}
                sdkConfig={sdkConfig}
                onDelete={onSelectDefaultTab}
            />
        </>
    );
}

function PlacementSettingsPanel({
    merchantId,
    placementId,
    sdkConfig,
    onDirtyChange,
}: {
    merchantId: string;
    placementId: string;
    sdkConfig: SdkConfig;
    onDirtyChange: (key: string, isDirty: boolean) => void;
}) {
    const {
        mutate: editSdkConfig,
        isPending,
        isSuccess,
    } = useMerchantUpdate({ merchantId, target: "sdk-config" });

    const values = useMemo<PlacementSettingsFormValues>(() => {
        const placement = sdkConfig.placements?.[placementId];
        return {
            triggerText: placement?.trigger?.text ?? "",
            triggerNoRewardText: placement?.trigger?.noRewardText ?? "",
            triggerPosition: placement?.trigger?.position ?? "bottom-right",
            triggerShowWallet: placement?.trigger?.showWallet ?? false,
            targetInteraction: placement?.targetInteraction ?? "",
        };
    }, [sdkConfig.placements, placementId]);

    const form = useForm<PlacementSettingsFormValues>({
        values,
        defaultValues: {
            triggerText: "",
            triggerNoRewardText: "",
            triggerPosition: "bottom-right",
            triggerShowWallet: false,
            targetInteraction: "",
        },
    });

    useEffect(() => {
        onDirtyChange(
            `placement-${placementId}-settings`,
            form.formState.isDirty
        );
        return () => onDirtyChange(`placement-${placementId}-settings`, false);
    }, [form.formState.isDirty, onDirtyChange, placementId]);

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    const onSubmit = useCallback(
        (currentValues: PlacementSettingsFormValues) => {
            editSdkConfig({
                placements: updatePlacement(
                    sdkConfig,
                    placementId,
                    (placement) => ({
                        ...placement,
                        trigger: {
                            text: valueOrUndefined(currentValues.triggerText),
                            noRewardText: valueOrUndefined(
                                currentValues.triggerNoRewardText
                            ),
                            position: currentValues.triggerPosition,
                            showWallet: currentValues.triggerShowWallet,
                        },
                        targetInteraction: valueOrUndefined(
                            currentValues.targetInteraction
                        ),
                    })
                ),
            });
        },
        [editSdkConfig, sdkConfig, placementId]
    );

    return (
        <Form {...form}>
            <Panel title={`Placement settings · ${placementId}`}>
                <div className={styles.customize__settingsGrid}>
                    <FormField
                        control={form.control}
                        name="triggerText"
                        rules={{
                            maxLength: {
                                value: 500,
                                message: "Maximum length is 500 characters",
                            },
                        }}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel weight={"medium"}>
                                    Trigger text
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        length={"big"}
                                        maxLength={500}
                                        placeholder={"Share and earn!"}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="triggerNoRewardText"
                        rules={{
                            maxLength: {
                                value: 500,
                                message: "Maximum length is 500 characters",
                            },
                        }}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel weight={"medium"}>
                                    Trigger no-reward text
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        length={"big"}
                                        maxLength={500}
                                        placeholder={
                                            "Share even without rewards"
                                        }
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="triggerPosition"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel weight={"medium"}>
                                    Trigger position
                                </FormLabel>
                                <FormControl>
                                    <select
                                        className={styles.customize__select}
                                        {...field}
                                    >
                                        <option value="bottom-right">
                                            Bottom right
                                        </option>
                                        <option value="bottom-left">
                                            Bottom left
                                        </option>
                                    </select>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="targetInteraction"
                        rules={{
                            maxLength: {
                                value: 200,
                                message: "Maximum length is 200 characters",
                            },
                        }}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel weight={"medium"}>
                                    Target interaction
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        length={"big"}
                                        maxLength={200}
                                        placeholder={"purchase_completed"}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="triggerShowWallet"
                        render={({ field }) => (
                            <FormItem className={styles.customize__switchRow}>
                                <FormLabel weight={"medium"}>
                                    Show wallet shortcut
                                </FormLabel>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormActions
                    isSuccess={isSuccess}
                    isPending={isPending}
                    isDirty={form.formState.isDirty}
                    onDiscard={() => form.reset(values)}
                    onSubmit={() => form.handleSubmit(onSubmit)()}
                />
            </Panel>
        </Form>
    );
}

function PlacementCssPanel({
    merchantId,
    placementId,
    sdkConfig,
    onDirtyChange,
}: {
    merchantId: string;
    placementId: string;
    sdkConfig: SdkConfig;
    onDirtyChange: (key: string, isDirty: boolean) => void;
}) {
    const {
        mutate: editSdkConfig,
        isPending,
        isSuccess,
    } = useMerchantUpdate({ merchantId, target: "sdk-config" });

    const values = useMemo<CssFormValues>(() => {
        const placement = sdkConfig.placements?.[placementId];
        return {
            css: placement?.css ?? "",
        };
    }, [sdkConfig.placements, placementId]);

    const form = useForm<CssFormValues>({
        values,
        defaultValues: {
            css: "",
        },
    });

    useEffect(() => {
        onDirtyChange(`placement-${placementId}-css`, form.formState.isDirty);
        return () => onDirtyChange(`placement-${placementId}-css`, false);
    }, [form.formState.isDirty, onDirtyChange, placementId]);

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    return (
        <Panel title={`Placement CSS · ${placementId}`}>
            <CssEditor
                value={form.watch("css")}
                onChange={(value) => {
                    form.setValue("css", value, { shouldDirty: true });
                }}
                placeholder={sdkConfig.css ?? ".frak-modal { ... }"}
                isPending={isPending}
                isSuccess={isSuccess}
                isDirty={form.formState.isDirty}
                onDiscard={() => form.reset(values)}
                onSave={() =>
                    editSdkConfig({
                        placements: updatePlacement(
                            sdkConfig,
                            placementId,
                            (placement) => ({
                                ...placement,
                                css: valueOrUndefined(form.getValues("css")),
                            })
                        ),
                    })
                }
            />
        </Panel>
    );
}

function PlacementTranslationsPanel({
    merchantId,
    placementId,
    sdkConfig,
    onDirtyChange,
}: {
    merchantId: string;
    placementId: string;
    sdkConfig: SdkConfig;
    onDirtyChange: (key: string, isDirty: boolean) => void;
}) {
    const {
        mutate: editSdkConfig,
        isPending,
        isSuccess,
    } = useMerchantUpdate({ merchantId, target: "sdk-config" });
    const [lang, setLang] = useState<TranslationLang>("default");

    const values = useMemo<TranslationFormValues>(
        () => getPlacementTranslationsFormValues(sdkConfig, placementId),
        [sdkConfig, placementId]
    );

    const inheritedValues = useMemo(
        () => getTranslationsFormValues(sdkConfig.translations),
        [sdkConfig.translations]
    );

    const form = useForm<TranslationFormValues>({
        values,
        defaultValues: {
            translationsDefault: {},
            translationsEn: {},
            translationsFr: {},
        },
    });

    useEffect(() => {
        onDirtyChange(
            `placement-${placementId}-translations`,
            form.formState.isDirty
        );
        return () =>
            onDirtyChange(`placement-${placementId}-translations`, false);
    }, [form.formState.isDirty, onDirtyChange, placementId]);

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    return (
        <Form {...form}>
            <Panel title={`Placement translations · ${placementId}`}>
                <TranslationEditor
                    form={form}
                    fieldPrefix={`placements.${placementId}.translations`}
                    defaultValues={inheritedValues}
                    lang={lang}
                    onLangChange={setLang}
                />

                <FormActions
                    isSuccess={isSuccess}
                    isPending={isPending}
                    isDirty={form.formState.isDirty}
                    onDiscard={() => form.reset(values)}
                    onSubmit={() => {
                        const payload = buildTranslationsPayload(
                            form.getValues()
                        );

                        editSdkConfig({
                            placements: updatePlacement(
                                sdkConfig,
                                placementId,
                                (placement) => ({
                                    ...placement,
                                    translations: payload.hasAnyValues
                                        ? payload.translations
                                        : undefined,
                                })
                            ),
                        });
                    }}
                />
            </Panel>
        </Form>
    );
}

function DeletePlacementPanel({
    merchantId,
    placementId,
    sdkConfig,
    onDelete,
}: {
    merchantId: string;
    placementId: string;
    sdkConfig: SdkConfig;
    onDelete: () => void;
}) {
    const { mutateAsync: editSdkConfig, isPending } = useMerchantUpdate({
        merchantId,
        target: "sdk-config",
    });
    const [open, setOpen] = useState(false);

    return (
        <Panel title={`Delete placement · ${placementId}`}>
            <p className={styles.customize__hint}>
                This removes all overrides for this placement.
            </p>
            <AlertDialog
                open={open}
                onOpenChange={setOpen}
                title={"Delete placement"}
                buttonElement={
                    <button
                        type="button"
                        className={styles.customize__deleteButton}
                    >
                        <Trash2 size={16} />
                        Delete {placementId}
                    </button>
                }
                description={`This will remove all overrides for placement ${placementId}.`}
                cancel={<Button variant={"outline"}>Cancel</Button>}
                action={
                    <Button
                        variant={"danger"}
                        isLoading={isPending}
                        disabled={isPending}
                        onClick={async () => {
                            const currentPlacements = {
                                ...(sdkConfig.placements ?? {}),
                            };
                            delete currentPlacements[placementId];
                            await editSdkConfig({
                                placements: currentPlacements,
                            });
                            onDelete();
                            setOpen(false);
                        }}
                    >
                        Delete placement
                    </Button>
                }
            />
        </Panel>
    );
}

function TranslationEditor({
    form,
    fieldPrefix,
    defaultValues,
    lang,
    onLangChange,
}: {
    form: UseFormReturn<TranslationFormValues>;
    fieldPrefix: string;
    defaultValues?: TranslationFormValues;
    lang: TranslationLang;
    onLangChange: (lang: TranslationLang) => void;
}) {
    const [expandedGroups, setExpandedGroups] = useState<
        Record<string, boolean>
    >({});
    const activeField = TRANSLATION_LANG_FIELDS[lang];

    return (
        <div>
            <div className={styles.customize__translationLangTabs}>
                <button
                    type="button"
                    className={`${styles.customize__translationLangTab} ${
                        lang === "default"
                            ? styles["customize__translationLangTab--active"]
                            : ""
                    }`}
                    onClick={() => onLangChange("default")}
                >
                    Default (all languages)
                </button>
                <button
                    type="button"
                    className={`${styles.customize__translationLangTab} ${
                        lang === "en"
                            ? styles["customize__translationLangTab--active"]
                            : ""
                    }`}
                    onClick={() => onLangChange("en")}
                >
                    English (EN)
                </button>
                <button
                    type="button"
                    className={`${styles.customize__translationLangTab} ${
                        lang === "fr"
                            ? styles["customize__translationLangTab--active"]
                            : ""
                    }`}
                    onClick={() => onLangChange("fr")}
                >
                    French (FR)
                </button>
            </div>

            {Object.entries(TRANSLATION_GROUPS).map(([groupName, keys]) => {
                const isExpanded = !!expandedGroups[groupName];

                return (
                    <div
                        key={groupName}
                        className={styles.customize__translationGroup}
                    >
                        <button
                            type="button"
                            className={styles.customize__translationGroupHeader}
                            onClick={() =>
                                setExpandedGroups((prevState) => ({
                                    ...prevState,
                                    [groupName]: !prevState[groupName],
                                }))
                            }
                        >
                            {isExpanded ? (
                                <ChevronDown size={16} />
                            ) : (
                                <ChevronRight size={16} />
                            )}
                            {groupName}
                        </button>

                        {isExpanded && (
                            <div
                                className={
                                    styles.customize__translationGroupBody
                                }
                            >
                                {keys.map((translationKey) => {
                                    const fieldName =
                                        `${activeField}.${translationKey}` as const;
                                    const inheritedValue =
                                        defaultValues?.[activeField]?.[
                                            translationKey
                                        ];
                                    const fieldError =
                                        form.formState.errors[activeField]?.[
                                            translationKey
                                        ]?.message;

                                    return (
                                        <div
                                            key={translationKey}
                                            className={
                                                styles.customize__translationRow
                                            }
                                        >
                                            <label
                                                className={
                                                    styles.customize__translationKey
                                                }
                                                htmlFor={`${fieldPrefix}.${fieldName}`}
                                            >
                                                {translationKey}
                                            </label>

                                            {inheritedValue && (
                                                <p
                                                    className={
                                                        styles.customize__hint
                                                    }
                                                >
                                                    Inherited default:{" "}
                                                    {inheritedValue}
                                                </p>
                                            )}

                                            <Input
                                                id={`${fieldPrefix}.${fieldName}`}
                                                length={"big"}
                                                placeholder={`Enter ${lang.toUpperCase()} override`}
                                                {...form.register(fieldName, {
                                                    validate: (
                                                        value: string
                                                    ) => {
                                                        const trimmed =
                                                            value?.trim() ?? "";
                                                        if (
                                                            trimmed.length === 0
                                                        ) {
                                                            return true;
                                                        }

                                                        if (
                                                            trimmed.length < 5
                                                        ) {
                                                            return "Minimum length is 5 characters";
                                                        }

                                                        if (
                                                            trimmed.length > 200
                                                        ) {
                                                            return "Maximum length is 200 characters";
                                                        }

                                                        return true;
                                                    },
                                                })}
                                            />

                                            {fieldError && (
                                                <p className={"error"}>
                                                    {String(fieldError)}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function CssEditor({
    value,
    onChange,
    placeholder,
    isPending,
    isSuccess,
    isDirty,
    onSave,
    onDiscard,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    isPending: boolean;
    isSuccess: boolean;
    isDirty: boolean;
    onSave: () => void;
    onDiscard: () => void;
}) {
    return (
        <>
            <textarea
                className={styles.customize__textarea}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
            />
            <FormActions
                isSuccess={isSuccess}
                isPending={isPending}
                isDirty={isDirty}
                onDiscard={onDiscard}
                onSubmit={onSave}
            />
        </>
    );
}
