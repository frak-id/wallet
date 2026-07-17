import { createContext, type ReactNode, useContext } from "react";

/**
 * The ingress correlation id (`x-request-id`) for the current request, provided
 * independently of any loader's return value.
 *
 * Why this exists: the merchant-facing `AppError` shows this id as a support
 * "Reference". It normally comes from the root loader (`root.tsx`), but when the
 * *root loader itself* throws, its data is gone — so the boundary would render
 * with no reference id even though the server logged one (a one-way divergence
 * exactly when correlation matters most). This context carries the id straight
 * from the server render (`entry.server.tsx`) so the boundary always has it.
 *
 * Hydration: on an SSR error page the value is echoed onto
 * `<html data-frak-req-id>` by the boundary and re-read by `entry.client.tsx`,
 * so the client provider matches the server value (no hydration mismatch).
 */
const RequestIdContext = createContext<string | null>(null);

export function RequestIdProvider({
    value,
    children,
}: {
    value: string | null;
    children: ReactNode;
}) {
    return (
        <RequestIdContext.Provider value={value}>
            {children}
        </RequestIdContext.Provider>
    );
}

/** Read the current request's correlation id, if available. */
export function useRequestId(): string | null {
    return useContext(RequestIdContext);
}
