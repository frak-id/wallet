import { useEstimatedInteractionReward } from "@/module/listener/hooks/useEstimatedInteractionReward";
import type { TOptions } from "i18next";
import { atom, useAtomValue } from "jotai";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { modalDisplayedRequestAtom } from "../modal/atoms/modalEvents";

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
        lang: request.metadata?.lang,
        context: {
            productName,
            productOrigin,
            context: finalStepKey,
        },
    };
});

export function useModalTranslation() {
    const { i18n } = useTranslation();
    const { lang, context } = useAtomValue(modalTranslationContextAtom);
    const { estimatedReward } = useEstimatedInteractionReward();

    // Transform the i18n instance to include the context
    const { newI18n, newT } = useMemo(() => {
        const newI18n = i18n.cloneInstance({
            lng: lang,
            interpolation: {
                defaultVariables: {
                    ...context,
                    estimatedReward,
                },
            },
        });
        const newT = newI18n.getFixedT(lang ?? "en", null) as typeof newI18n.t;
        return { newI18n, newT };
    }, [i18n, lang, context, estimatedReward]);

    // Build the translation with context function
    const translationWithContext = useCallback(
        (key: string, options?: TOptions) => {
            return newT(key, {
                ...context,
                ...options,
                estimatedReward,
            });
        },
        [newT, context, estimatedReward]
    );

    return { t: translationWithContext, i18n: newI18n };
}
