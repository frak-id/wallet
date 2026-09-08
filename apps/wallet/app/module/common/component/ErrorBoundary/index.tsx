import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { recordError } from "@frak-labs/wallet-shared";
import { CatchBoundary } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import * as styles from "./index.css";

/**
 * Constant: these boundaries sit inside a layout component, not on a route,
 * so they clear on unmount. A reload is the only other way out.
 */
const RESET_KEY = "wallet-error-boundary";

/**
 * Fallback for a caught render error. Depends on nothing that could have
 * thrown — no i18n, no router, no context — because it also serves the
 * `_wallet` boundary, which fires when `AppShell` itself fails.
 */
export function ErrorFallback() {
    const actionRef = useRef<HTMLButtonElement>(null);

    // The thrown subtree may have held focus; leaving it detached strands
    // keyboard users with no route to the only action on screen.
    useEffect(() => actionRef.current?.focus(), []);

    return (
        <Box role="alert" className={styles.fallback}>
            <Text variant="heading2">Something went wrong</Text>
            <Text variant="bodySmall" className={styles.description}>
                Reload the page to continue.
            </Text>
            <Button
                ref={actionRef}
                // Assets are served immutable and the service worker caches
                // none of them, so a full load is what fetches the current
                // manifest. An in-place reset would re-render the same
                // stale bundle.
                onClick={() => location.reload()}
            >
                Reload
            </Button>
        </Box>
    );
}

/**
 * Contains a render error to the region it happened in. Mounted inside
 * `AppShell` so the shell's chrome survives, and on `_wallet`, which has none.
 */
export function ErrorBoundary({ children }: { children: ReactNode }) {
    return (
        <CatchBoundary
            getResetKey={() => RESET_KEY}
            onCatch={(error) =>
                recordError(error, { source: "error_boundary" })
            }
            errorComponent={ErrorFallback}
        >
            {children}
        </CatchBoundary>
    );
}
