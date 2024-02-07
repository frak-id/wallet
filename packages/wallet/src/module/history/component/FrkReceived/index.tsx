"use client";

import { formatFrk } from "@/context/wallet/utils/frkFormatter";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { PolygonLink } from "@/module/wallet/component/PolygonLink";
import type { FrkReceived as FrkReceivedType } from "@/types/HistoryItem";

type ArticleUnlockProps = {
    frkReceived: FrkReceivedType;
};

export function FrkReceived({ frkReceived }: ArticleUnlockProps) {
    return (
        <Panel>
            <Title>Fraks received</Title>
            <p>
                Transaction: <PolygonLink hash={frkReceived.txHash} />
            </p>
            <p>Frak amount: {formatFrk(Number(frkReceived.receivedAmount))}</p>
        </Panel>
    );
}
