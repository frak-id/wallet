/**
 * Generic type of modal we will display to the end user
 */
export type GenericModalType<TKey extends string, TParams, TReturns> = {
    key: TKey;
    params: TParams;
    returns: TReturns;
};
