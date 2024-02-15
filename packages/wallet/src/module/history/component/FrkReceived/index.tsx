"use client";

import { formatFrk } from "@/context/wallet/utils/frkFormatter";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { PolygonLink } from "@/module/wallet/component/PolygonLink";
import type { FrkReceived as FrkReceivedType } from "@/types/HistoryItem";
import { HandCoins } from "lucide-react";

type ArticleUnlockProps = {
    frkReceived: FrkReceivedType;
};

export function FrkReceived({ frkReceived }: ArticleUnlockProps) {
    return (
        <Panel size={"small"}>
            <Title icon={<HandCoins />}>
                <strong>{formatFrk(Number(frkReceived.receivedAmount))}</strong>{" "}
                received
            </Title>
            <Row withIcon={true}>
                From: <PolygonLink wallet={true} hash={frkReceived.fromHash} />
            </Row>
            <Row withIcon={true}>
                Transaction: <PolygonLink hash={frkReceived.txHash} />
            </Row>
        </Panel>
    );
}
