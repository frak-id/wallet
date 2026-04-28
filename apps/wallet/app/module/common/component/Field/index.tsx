import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";

/**
 * Indented label sitting above a bare `Input`. 14px Inter Medium /
 * secondary tone.
 *
 * The 16px (`paddingX="m"`) indent is intentionally kept in sync with
 * `inputWrapper.variants.variant.bare.paddingInline` in
 * `packages/design-system/src/components/Input/input.css.ts`. If that
 * padding ever changes, update both call sites.
 */
export function FieldLabel({ children }: { children: ReactNode }) {
    return (
        <Box paddingX={"m"}>
            <Text variant="bodySmall" weight="medium" color="secondary">
                {children}
            </Text>
        </Box>
    );
}

/**
 * Indented error caption sitting under a bare `Input`. Same 16px indent
 * as `FieldLabel` (see note there) for vertical alignment.
 */
export function FieldError({ children }: { children: ReactNode }) {
    return (
        <Box paddingX={"m"}>
            <Text variant="caption" color="error">
                {children}
            </Text>
        </Box>
    );
}
