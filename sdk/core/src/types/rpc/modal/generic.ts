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
 * Metadata that can be used to customise a modal step
 * @group Modal Display
 */
export type ModalStepMetadata = {
    metadata?: {
        /**
         * Custom title for the step
         * If none provided, it will use an internationalised text
         */
        title?: string;
        /**
         * Custom description for the step
         * If none provided, it will use an internationalised text
         */
        description?: string;
        /**
         * Custom text for the primary action of the step
         * If none provided, it will use an internationalised text
         */
        primaryActionText?: string;
        /**
         * Custom text for the secondary action of the step
         * If none provided, it will use an internationalised text
         */
        secondaryActionText?: string;
    };
};
