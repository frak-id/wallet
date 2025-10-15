"use client";

import { useSetAtom } from "jotai";
import { type PropsWithChildren, useEffect } from "react";
import { campaignActionAtom } from "@/module/campaigns/atoms/campaign";

/**
 * Campaign create component
 * @param params
 * @constructor
 */
export function CampaignCreate({ children }: PropsWithChildren) {
    const setCampaignAction = useSetAtom(campaignActionAtom);

    useEffect(() => {
        setCampaignAction("create");
    }, [setCampaignAction]);

    return children;
}
