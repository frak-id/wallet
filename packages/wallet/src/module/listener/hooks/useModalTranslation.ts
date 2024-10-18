import type { TOptions } from "i18next";
import { atom, useAtomValue } from "jotai";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { modalDisplayedRequestAtom } from "../atoms/modalEvents";

/**
 * Simple atom for our base translation context
 */
const modalTranslationContextAtom = atom((get) => {
    const request = get(modalDisplayedRequestAtom);
    if (!request) return {};

    // Check if we got a final step context
    const finalStepKey = request.steps?.final?.action?.key;

    // Also get the app name
    const productName = request.appName;
    const productOrigin = request.context.origin;

    return {
        productName,
        productOrigin,
        context: finalStepKey,
    };
});

export function useModalTranslation() {
    const { t, i18n } = useTranslation();
    const context = useAtomValue(modalTranslationContextAtom);

    const translationWithContext = useCallback(
        (key: string, options?: TOptions) => {
            return t(key, {
                ...context,
                ...options,
            });
        },
        [t, context]
    );

    // Transform the i18n instance to include the context
    const i18nWithContext = useMemo(() => {
        return i18n.cloneInstance({
            interpolation: {
                defaultVariables: {
                    ...context,
                },
            },
        });
    }, [i18n, context]);

    return { t: translationWithContext, i18n: i18nWithContext };
}
