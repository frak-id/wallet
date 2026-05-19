import { Inline } from "@frak-labs/design-system/components/Inline";
import type { ReactNode } from "react";
import { Panel } from "@/module/common/component/Panel";

export function ActionsWrapper({
    left,
    right,
}: {
    left?: ReactNode;
    right?: ReactNode;
}) {
    return (
        <Panel variant={"secondary"}>
            <Inline align="space-between" alignY="center" space="m">
                <Inline space="s" alignY="center">
                    {left}
                </Inline>
                <Inline space="xs" alignY="center">
                    {right}
                </Inline>
            </Inline>
        </Panel>
    );
}
