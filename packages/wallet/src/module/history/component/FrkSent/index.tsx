"use client";

import { formatFrk } from "@/context/wallet/utils/frkFormatter";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { PolygonLink } from "@/module/wallet/component/PolygonLink";
import type { FrkSent as FrkSentType } from "@/types/HistoryItem";
import { HandCoins } from "lucide-react";

type ArticleUnlockProps = {
    frkSent: FrkSentType;
};

export function FrkSent({ frkSent }: ArticleUnlockProps) {
    return (
        <Panel size={"small"}>
            <Title icon={<HandCoins />}>
                <strong>{formatFrk(Number(frkSent.sentAmount))}</strong> sent
            </Title>
            <Row withIcon={true}>
                To: <PolygonLink wallet={true} hash={frkSent.toHash} />
            </Row>
            <Row withIcon={true}>
                Transaction: <PolygonLink hash={frkSent.txHash} />
            </Row>
        </Panel>
    );
}
