import { useCallback, useEffect, useRef } from "react";

interface IntersectionOptions {
    threshold?: number;
    oneShot?: boolean;
    onIntersect?: () => Promise<void>;
}

export function useIntersectionObserver<T extends Element = Element>({
    threshold,
    oneShot = false,
    onIntersect,
}: IntersectionOptions) {
    // Using ref instead of state for all of this states since we don't want them to cause re-renders
    const targetRef = useRef<T>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const hasTriggeredRef = useRef(false);
    const callbackRef = useRef(onIntersect);

    // Update the callback ref if onIntersect changes
    useEffect(() => {
        callbackRef.current = onIntersect;
    }, [onIntersect]);

    // Handle the intersection
    const handleIntersection = useCallback(
        async (entries: IntersectionObserverEntry[]) => {
            const [entry] = entries;
            if (oneShot && hasTriggeredRef.current) {
                return;
            }

            if (entry.isIntersecting) {
                hasTriggeredRef.current = true;
                await callbackRef.current?.();
            }
        },
        [oneShot]
    );

    useEffect(() => {
        const currentTarget = targetRef.current;
        const currentObserver = new IntersectionObserver(handleIntersection, {
            threshold,
        });

        if (currentTarget) {
            currentObserver.observe(currentTarget);
        }

        observerRef.current = currentObserver;
        return () => {
            if (currentTarget) {
                currentObserver.unobserve(currentTarget);
            }
        };
    }, [handleIntersection, threshold]);

    return { targetRef, hasTriggeredRef: hasTriggeredRef.current } as const;
}
