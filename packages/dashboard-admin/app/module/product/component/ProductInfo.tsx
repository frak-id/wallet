import type { GetProductInfoResponseDto } from "@frak-labs/app-essentials";
import { productTypesMask } from "@frak-labs/core-sdk";
import { toHex } from "viem";
import { ProductBanksList } from "~/module/bank/component/ProductBanks";
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
import { useProductInfo } from "../hook/useProductInfo";

export function ProductInfo({ id }: { id: string }) {
    const { product, isLoading } = useProductInfo(id);

    if (!id) {
        return (
            <div className="p-4 text-center text-muted-foreground">
                No id provided
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="p-4 text-center text-muted-foreground">
                Loading...
            </div>
        );
    }

    if (!product) {
        return (
            <div className="p-4 text-center text-muted-foreground">
                Product not found
            </div>
        );
    }

    return (
        <>
            <GeneralInfo info={product.product} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <ProductBanksList banks={product.banks} />
                <InteractionContractsList
                    contracts={product.interactionContracts}
                />
            </div>

            <AdministratorsList administrators={product.administrators} />
            <CampaignsTable campaigns={product.campaigns} />
        </>
    );
}

function GeneralInfo({ info }: { info: GetProductInfoResponseDto["product"] }) {
    const readableCreationDate = new Date(
        Number(info.createTimestamp) * 1000
    ).toLocaleDateString();
    const types = Object.entries(productTypesMask)
        .filter(
            ([_, value]) => (BigInt(info.productTypes) & value) !== BigInt(0)
        )
        .map(([key]) => key)
        .join(", ");

    return (
        <Card className="overflow-hidden">
            <CardHeader>
                <CardTitle className="text-xl">Product Information</CardTitle>
                <CardDescription>
                    Basic details about this product
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        Name
                    </h4>
                    <p className="font-medium">{info.name}</p>
                </div>
                <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        Domain
                    </h4>
                    <p className="font-medium">{info.domain}</p>
                </div>
                <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        Created
                    </h4>
                    <p className="font-medium">{readableCreationDate}</p>
                </div>
                <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        Types
                    </h4>
                    <p className="font-medium">{types}</p>
                </div>
                <div className="sm:col-span-2">
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                        ID
                    </h4>
                    <p className="font-mono text-sm">
                        {toHex(BigInt(info.id))}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

function InteractionContractsList({
    contracts,
}: { contracts: GetProductInfoResponseDto["interactionContracts"] }) {
    if (contracts.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Interaction Contracts</CardTitle>
                    <CardDescription>
                        Interaction contract details
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <p className="text-muted-foreground italic">
                        No interaction contracts associated with this product
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Interaction Contracts</CardTitle>
                <CardDescription>Interaction contract details</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <ul className="space-y-4">
                    {contracts.map((contract) => {
                        const isActive = !contract.removedTimestamp;

                        return (
                            <li
                                key={contract.id}
                                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium">Contract</h4>
                                    <div
                                        className={`text-xs px-2 py-1 rounded-full ${isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                                    >
                                        {isActive ? "Active" : "Removed"}
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <p>
                                        <span className="text-muted-foreground">
                                            Address:
                                        </span>{" "}
                                        <span className="font-mono">
                                            {toHex(BigInt(contract.id))}
                                        </span>
                                    </p>
                                    <p>
                                        <span className="text-muted-foreground">
                                            Referral Tree:
                                        </span>{" "}
                                        {contract.referralTree}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t">
                                        <div>
                                            <p className="text-muted-foreground text-xs">
                                                Created
                                            </p>
                                            <p className="font-medium">
                                                {new Date(
                                                    Number(
                                                        contract.createdTimestamp
                                                    ) * 1000
                                                ).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">
                                                Last Updated
                                            </p>
                                            <p className="font-medium">
                                                {contract.lastUpdateTimestamp
                                                    ? new Date(
                                                          Number(
                                                              contract.lastUpdateTimestamp
                                                          ) * 1000
                                                      ).toLocaleDateString()
                                                    : "Never"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </CardContent>
        </Card>
    );
}

function AdministratorsList({
    administrators,
}: { administrators: GetProductInfoResponseDto["administrators"] }) {
    if (administrators.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Administrators</CardTitle>
                    <CardDescription>
                        Users with administrative access
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <p className="text-muted-foreground italic">
                        No administrators associated with this product
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Administrators</CardTitle>
                <CardDescription>
                    Users with administrative access
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {administrators.map((admin) => (
                        <div
                            key={admin.user}
                            className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium">Administrator</h4>
                                <div
                                    className={`text-xs px-2 py-1 rounded-full ${admin.isOwner ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}`}
                                >
                                    {admin.isOwner ? "Owner" : "Administrator"}
                                </div>
                            </div>
                            <div className="space-y-2 text-sm">
                                <p>
                                    <span className="text-muted-foreground">
                                        User:
                                    </span>{" "}
                                    <span className="font-mono">
                                        {admin.user}
                                    </span>
                                </p>
                                <p>
                                    <span className="text-muted-foreground">
                                        Roles:
                                    </span>{" "}
                                    {admin.roles}
                                </p>
                                <p>
                                    <span className="text-muted-foreground">
                                        Created:
                                    </span>{" "}
                                    {new Date(
                                        Number(admin.createdTimestamp) * 1000
                                    ).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function CampaignsTable({
    campaigns,
}: { campaigns: GetProductInfoResponseDto["campaigns"] }) {
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
                                <TableHead>Type</TableHead>
                                <TableHead>Version</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Contract Address</TableHead>
                                <TableHead>Banking Contract</TableHead>
                                <TableHead>Banking Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {campaigns.map((campaign) => (
                                <TableRow
                                    key={campaign.id}
                                    className="hover:bg-muted/50"
                                >
                                    <TableCell className="font-medium">
                                        {campaign.name}
                                    </TableCell>
                                    <TableCell>{campaign.type}</TableCell>
                                    <TableCell>{campaign.version}</TableCell>
                                    <TableCell>
                                        <div
                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${campaign.attached ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}
                                        >
                                            {campaign.attached
                                                ? "Attached"
                                                : "Detached"}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {toHex(BigInt(campaign.id))}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {toHex(
                                            BigInt(campaign.bankingContractId)
                                        )}
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
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
