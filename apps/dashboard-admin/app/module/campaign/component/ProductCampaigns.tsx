import type { GetProductInfoResponseDto } from "@frak-labs/app-essentials";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@radix-ui/react-tooltip";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/module/common/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/module/common/components/ui/table";
import { useCanDistributeFromCampaign } from "../../bank/hook/useCanDistributeFromCampaign";
import { useOnChainCampaignInfo } from "../hook/useOnChainCampaignInfo";

export function ProductCampaigns({
    campaigns,
}: {
    campaigns: GetProductInfoResponseDto["campaigns"];
}) {
    if (campaigns.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Campaigns</CardTitle>
                    <CardDescription>
                        Associated marketing campaigns
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <p className="text-muted-foreground italic">
                        No campaigns associated with this product
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <TooltipProvider>
                <CardHeader>
                    <CardTitle>Campaigns</CardTitle>
                    <CardDescription>
                        Associated marketing campaigns
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Name</TableHead>
                                    <TableHead>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                Active
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <div className="space-y-2 bg-background p-2 rounded-md">
                                                    Is everything op on the
                                                    blockchain side for this
                                                    campaign?
                                                    <br />
                                                    <br />
                                                    If the campaign is detached
                                                    from the interaction
                                                    contract, it can still be
                                                    active, just it will never
                                                    be called.
                                                    <br />
                                                    <br />
                                                    Possible reasons for this to
                                                    be false:
                                                    <ul>
                                                        <li>
                                                            - Campaign was
                                                            disabled by the
                                                            owner (running at
                                                            false)
                                                        </li>
                                                        <li>
                                                            - Activation dates
                                                            invalid (either not
                                                            started yet, or
                                                            ended)
                                                        </li>
                                                        <li>
                                                            - Goal reached
                                                            (amount distributed
                                                            given the time
                                                            frame)
                                                        </li>
                                                        <li>
                                                            - Bank doesn't
                                                            authorize this
                                                            campaign to
                                                            distribute tokens
                                                        </li>
                                                        <li>
                                                            - Bank fully
                                                            disabled
                                                        </li>
                                                    </ul>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableHead>
                                    <TableHead>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                Running
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <div className="space-y-2 bg-background p-2 rounded-md">
                                                    Is the campaign currently
                                                    running?
                                                    <br />
                                                    <br />
                                                    The owner can start / stop
                                                    it's campaign at any time in
                                                    the dashboard.
                                                    <br />
                                                    <br />A running campaign
                                                    doesn't mean it's able to
                                                    distribute rewards, check
                                                    the Active column for that.
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableHead>
                                    <TableHead>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                Token Distribution
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <div className="space-y-2 bg-background p-2 rounded-md">
                                                    Is this campaign currently
                                                    able to distribute tokens?
                                                    <br />
                                                    <br />
                                                    Two possible reasons for
                                                    this to be false:
                                                    <ul>
                                                        <li>
                                                            - The campaign is
                                                            not active
                                                        </li>
                                                        <li>
                                                            - The bank doesn't
                                                            authorize this
                                                            campaign to
                                                            distribute tokens
                                                        </li>
                                                    </ul>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableHead>
                                    <TableHead>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                Attached
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <div className="space-y-2 bg-background p-2 rounded-md">
                                                    Is this campaign currently
                                                    attached to the interaction
                                                    contract?
                                                    <br />
                                                    <br />
                                                    If it's not attached, it
                                                    can't be active or running.
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableHead>
                                    <TableHead>Banking Authorization</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Version</TableHead>
                                    <TableHead>Contract Address</TableHead>
                                    <TableHead>Banking Contract</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {campaigns.map((campaign) => (
                                    <CampaignRow
                                        key={campaign.id}
                                        campaign={campaign}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </TooltipProvider>
        </Card>
    );
}

function CampaignRow({
    campaign,
}: {
    campaign: GetProductInfoResponseDto["campaigns"][number];
}) {
    const { info } = useOnChainCampaignInfo(campaign.id);
    const { canDistribute, isLoading } = useCanDistributeFromCampaign({
        bank: campaign.bankingContractId,
        campaign: campaign.id,
    });

    return (
        <TableRow className="hover:bg-muted/50">
            <TableCell className="font-medium">{campaign.name}</TableCell>
            <TableCell>
                {info?.isActive ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                )}
            </TableCell>
            <TableCell>
                {info?.isRunning ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                )}
            </TableCell>
            <TableCell>
                {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : canDistribute ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                )}
            </TableCell>
            <TableCell>
                <div
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${campaign.attached ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}
                >
                    {campaign.attached ? "Attached" : "Detached"}
                </div>
            </TableCell>
            <TableCell>
                <div
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${campaign.isAuthorisedOnBanking ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                >
                    {campaign.isAuthorisedOnBanking
                        ? "Authorized"
                        : "Unauthorized"}
                </div>
            </TableCell>
            <TableCell>{campaign.type}</TableCell>
            <TableCell>{campaign.version}</TableCell>
            <TableCell className="font-mono text-xs">{campaign.id}</TableCell>
            <TableCell className="font-mono text-xs">
                {campaign.bankingContractId}
            </TableCell>
        </TableRow>
    );
}
