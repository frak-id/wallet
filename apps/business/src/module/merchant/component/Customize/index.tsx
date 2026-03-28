import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { Button } from "@frak-labs/ui/component/Button";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
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
import { MerchantHead } from "@/module/merchant/component/MerchantHead";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { useSdkConfig } from "@/module/merchant/hook/useSdkConfig";
import { DefaultCustomization } from "./DefaultCustomization";
import styles from "./index.module.css";
import { PlacementCustomization } from "./PlacementCustomization";
import { getSdkConfig, type SdkIdentityFormValues, valueOrNull } from "./utils";

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
