import {
    Button as DSButton,
    type ButtonProps as DSButtonProps,
} from "@frak-labs/design-system/components/Button";

export type ButtonProps = DSButtonProps;

/**
 * Business-app Button: thin wrapper over the design-system Button that
 * defaults `size` to `"medium"` and `width` to `"auto"` (DS defaults are
 * `"large"` + `"full"`, which read as oversized in dashboard layouts).
 */
export function Button(props: ButtonProps) {
    return <DSButton size="medium" width="auto" {...props} />;
}
