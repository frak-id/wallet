/**
 * Represent a generic modal step type
 * @ignore
 * @inline
 */
export type GenericModalStepType<TKey, TParams, TReturns> = {
    key: TKey;
    params: TParams extends never
        ? ModalStepMetadata
        : ModalStepMetadata & TParams;
    returns: TReturns;
};

/**
 * Metadata that can be used to customize a modal step
 * @group Modal Display
 * @deprecated Use the top level `config.customizations.i18n`, or `metadata.i18n` instead
 */
export type ModalStepMetadata = {
    metadata?: {
        /**
         * Custom title for the step
         * If none provided, it will use an internationalized text
         * @deprecated Use the top level `config.customizations.i18n`, or `metadata.i18n` instead
         */
        title?: string;
        /**
         * Custom description for the step
         * If none provided, it will use an internationalized text
         * @deprecated Use the top level `config.customizations.i18n`, or `metadata.i18n` instead
         */
        description?: string;
        /**
         * Custom text for the primary action of the step
         * If none provided, it will use an internationalized text
         * @deprecated Use the top level `config.customizations.i18n`, or `metadata.i18n` instead
         */
        primaryActionText?: string;
        /**
         * Custom text for the secondary action of the step
         * If none provided, it will use an internationalized text
         * @deprecated Use the top level `config.customizations.i18n`, or `metadata.i18n` instead
         */
        secondaryActionText?: string;
    };
};
