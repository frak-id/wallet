import { Stack } from "@frak-labs/design-system/components/Stack";
import { LogoFrakWithName } from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import { main } from "./embeddedShell.css";

/**
 * Shared chrome for the embedded popup screens (auth + mint): full-bleed
 * background, centered modal-width column, and the Frak wordmark. Auth lives
 * outside the guarded `_layout` route, so the shell is shared rather than
 * nested via an `<Outlet>`.
 */
export function EmbeddedShell({ children }: { children: ReactNode }) {
    return (
        <main className={main} data-embedded-layout>
            <Stack space="l">
                <LogoFrakWithName />
                {children}
            </Stack>
        </main>
    );
}
