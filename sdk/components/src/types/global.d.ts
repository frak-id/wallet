import type {
    DisplayEmbeddedWalletParamsType,
    DisplayModalParamsType,
    FrakClient,
    FrakWalletSdkConfig,
    I18nConfig,
} from "@frak-labs/core-sdk";
import type { ModalBuilder } from "@frak-labs/core-sdk/actions";

declare global {
    interface Window {
        FrakSetup: {
            core?: unknown;
            client?: FrakClient;
            config?: FrakWalletSdkConfig;
            campaignI18n?: Record<string, I18nConfig>;
            modalConfig?: DisplayModalParamsType;
            modalShareConfig?: { link: string };
            modalWalletConfig?: DisplayEmbeddedWalletParamsType;
        };
        modalBuilderSteps?: ModalBuilder;
        frakSetupInProgress?: boolean;
    }
}
