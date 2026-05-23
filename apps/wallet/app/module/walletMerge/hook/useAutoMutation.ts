import type { UseMutationResult } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

export type UseAutoMutationOptions<TData, TVars> = {
    /**
     * Auto-fire toggle. When `true`, the mutation runs once on the first
     * render where the condition is met and the ref guard latches; flipping
     * back to `false` and forward to `true` does NOT re-fire. Defaults to
     * `true`. Use `false` when the step has an explicit CTA owning the
     * initial fire — `run` is still exposed for manual triggers and retries.
     */
    enabled?: boolean;
    /** Mutation variables. Re-read from the ref on every `run` invocation. */
    vars: TVars;
    /** Resolves once the mutation succeeds. */
    onSuccess?: (data: TData) => void;
};

/**
 * Auto-fires a mutation once when `enabled` becomes true and exposes a
 * stable `run` callback for explicit re-fires.
 *
 * The ref-gated single-shot semantics replace the
 * `startedRef + useCallback + useEffect` boilerplate that was duplicated
 * across the merge step components (ConsentStep, SettlingStep).
 * Callers compose any upstream resets (e.g.
 * `mutation.reset()`, `strategy.remote?.onRetry()`) around `run` as
 * needed — the hook only owns the auto-fire gate and the latest-vars
 * threading.
 */
export function useAutoMutation<TData, TError, TVars>(
    mutation: UseMutationResult<TData, TError, TVars>,
    { enabled = true, vars, onSuccess }: UseAutoMutationOptions<TData, TVars>
): { run: () => void } {
    const startedRef = useRef(false);
    const varsRef = useRef(vars);
    varsRef.current = vars;
    const onSuccessRef = useRef(onSuccess);
    onSuccessRef.current = onSuccess;
    const mutateRef = useRef(mutation.mutate);
    mutateRef.current = mutation.mutate;

    const run = useCallback(() => {
        startedRef.current = true;
        const cb = onSuccessRef.current;
        mutateRef.current(varsRef.current, cb ? { onSuccess: cb } : undefined);
    }, []);

    useEffect(() => {
        if (!enabled) return;
        if (startedRef.current) return;
        startedRef.current = true;
        run();
    }, [enabled, run]);

    return { run };
}
