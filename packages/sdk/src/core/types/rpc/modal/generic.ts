/**
 * Represent a generic modal step type
 */
export type GenericModalStepType<TKey, TParams, TReturns> = {
    key: TKey;
    params: TParams extends never
        ? ModalStepMetadata
        : ModalStepMetadata & TParams;
    returns: TReturns;
};

export type ModalStepMetadata = {
    hidden?: boolean;
    metadata?: {
        title?: string;
        description?: string;
        primaryActionText?: string;
        secondaryActionText?: string;
    };
};
