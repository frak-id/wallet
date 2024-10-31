import type { SerializeFrom } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import type { AppData } from "@remix-run/react/dist/data";
import { useCallback, useEffect, useRef } from "react";

type FetcherData<T> = NonNullable<SerializeFrom<T>>;
type ResolveFunction<T> = (value: FetcherData<T>) => void;

/**
 * Wrapper around useFetcher that returns a promise that resolves when the fetcher is done
 * @param opts
 */
export function useFetcherWithPromise<TData = AppData>(
    opts?: Parameters<typeof useFetcher>[0]
) {
    const fetcher = useFetcher<TData>(opts);
    const resolveRef = useRef<ResolveFunction<TData>>();
    const promiseRef = useRef<Promise<FetcherData<TData>>>();

    if (!promiseRef.current) {
        promiseRef.current = new Promise<FetcherData<TData>>((resolve) => {
            resolveRef.current = resolve;
        });
    }

    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    const resetResolver = useCallback(() => {
        promiseRef.current = new Promise((resolve) => {
            resolveRef.current = resolve;
        });
    }, [promiseRef, resolveRef]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    const submit = useCallback(
        async (...args: Parameters<typeof fetcher.submit>) => {
            fetcher.submit(...args);
            return promiseRef.current;
        },
        [fetcher, promiseRef]
    );

    useEffect(() => {
        if (fetcher.state === "idle") {
            if (fetcher.data) {
                resolveRef.current?.(fetcher.data);
                resetResolver();
            }
            // resetResolver();
        }
    }, [fetcher, resetResolver]);

    return { ...fetcher, submit };
}
