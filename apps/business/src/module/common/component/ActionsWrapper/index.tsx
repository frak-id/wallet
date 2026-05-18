import type { ReactNode } from "react";
import { Panel } from "@/module/common/component/Panel";
import { actionLeft, actionRight, actions } from "./actions-wrapper.css";

export function ActionsWrapper({
    left,
    right,
}: {
    left?: ReactNode;
    right?: ReactNode;
}) {
    return (
        <Panel variant={"secondary"} className={actions}>
            {left && <div className={actionLeft}>{left}</div>}
            {right && <div className={actionRight}>{right}</div>}
        </Panel>
    );
}
