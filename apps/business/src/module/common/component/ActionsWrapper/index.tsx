import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import type { ReactNode } from "react";

export function ActionsWrapper({
    left,
    right,
}: {
    left?: ReactNode;
    right?: ReactNode;
}) {
    return (
        <Card>
            <Inline align="space-between" alignY="center" space="m">
                <Inline space="s" alignY="center">
                    {left}
                </Inline>
                <Inline space="xs" alignY="center">
                    {right}
                </Inline>
            </Inline>
        </Card>
    );
}
