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
         * @default Internationalised text
         */
        title?: string;
        /**
         * Custom description for the step
         * @default Internationalised text
         */
        description?: string;
        /**
         * Custom text for the primary action of the step
         * @default Internationalised text
         */
        primaryActionText?: string;
        /**
         Custom text for the secondary action of the step
         * @default Internationalised text
         */
        secondaryActionText?: string;
    };
};
