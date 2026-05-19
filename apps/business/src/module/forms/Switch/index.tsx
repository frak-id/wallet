import { Switch as DSSwitch } from "@frak-labs/design-system/components/Switch";
import type { ComponentPropsWithRef } from "react";

export const Switch = ({
    ref,
    ...props
}: ComponentPropsWithRef<typeof DSSwitch>) => <DSSwitch ref={ref} {...props} />;

Switch.displayName = "Switch";
