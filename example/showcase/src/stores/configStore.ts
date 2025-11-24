import { create } from "zustand";
import { persist } from "zustand/middleware";

type SDKMetadata = {
    name: string;
    lang?: string;
    currency?: string;
    logoUrl?: string;
    homepageLink?: string;
};

type SDKCustomizations = {
    css?: string;
    i18n: Record<string, Record<string, string>>;
};

type SDKConfig = {
    metadata: SDKMetadata;
    customizations: SDKCustomizations;
};

type ConfigStore = {
    config: SDKConfig;
    updateMetadata: (metadata: Partial<SDKMetadata>) => void;
    updateCustomizations: (customizations: Partial<SDKCustomizations>) => void;
    updateI18n: (lang: string, translations: Record<string, string>) => void;
    resetConfig: () => void;
};

const defaultConfig: SDKConfig = {
    metadata: {
        name: "",
        lang: "auto",
        currency: "eur",
    },
    customizations: {
        i18n: {},
    },
};

export const useConfigStore = create<ConfigStore>()(
    persist(
        (set) => ({
            config: defaultConfig,
            updateMetadata: (metadata) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        metadata: { ...state.config.metadata, ...metadata },
                    },
                })),
            updateCustomizations: (customizations) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        customizations: {
                            ...state.config.customizations,
                            ...customizations,
                        },
                    },
                })),
            updateI18n: (lang, translations) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        customizations: {
                            ...state.config.customizations,
                            i18n: {
                                ...state.config.customizations.i18n,
                                [lang]: {
                                    ...state.config.customizations.i18n[lang],
                                    ...translations,
                                },
                            },
                        },
                    },
                })),
            resetConfig: () => set({ config: defaultConfig }),
        }),
        {
            name: "frak-example-config",
            onRehydrateStorage: () => (_state, error) => {
                if (error) {
                    console.error("Failed to rehydrate config state:", error);
                }
            },
        }
    )
);
