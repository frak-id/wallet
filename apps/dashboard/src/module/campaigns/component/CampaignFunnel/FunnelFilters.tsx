"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyCampaignsStats } from "@/context/campaigns/action/getCampaignsStats";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/module/forms/Select";

type Props = {
    value: string;
    onChangeAction: (value: string) => void;
};

export function FunnelFilters({ value, onChangeAction }: Props) {
    const { data: campaigns, isLoading } = useQuery({
        queryKey: ["campaigns", "stats"],
        queryFn: () => getMyCampaignsStats(),
    });

    if (isLoading) {
        return null;
    }

    return (
        <Select value={value} onValueChange={onChangeAction}>
            <SelectTrigger length="medium">
                <SelectValue placeholder="All campaigns" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {campaigns?.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.title}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
