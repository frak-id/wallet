import type { GetProductInfoResponseDto } from "@frak-labs/app-essentials";
import { productTypesMask } from "@frak-labs/core-sdk";
import { toHex } from "viem";
import {
    Card,
    CardContent,
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
        return <div>No id provided</div>;
    }

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (!product) {
        return <div>Product not found</div>;
    }

    return (
        <div className="space-y-6">
            <GeneralInfo info={product.product} />
            <BanksList banks={product.banks} />
            <InteractionContractsList
                contracts={product.interactionContracts}
            />
            <AdministratorsList administrators={product.administrators} />
            <CampaignsTable campaigns={product.campaigns} />
        </div>
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
        <Card>
            <CardHeader>
                <CardTitle>Info</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Name: {info.name}</p>
                <p>Domain: {info.domain}</p>
                <p>Created at: {readableCreationDate}</p>
                <p>Types: {types}</p>
                <p>Id: {toHex(BigInt(info.id))}</p>
            </CardContent>
        </Card>
    );
}

function BanksList({ banks }: { banks: GetProductInfoResponseDto["banks"] }) {
    if (banks.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Banks</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>No banks associated with this product</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Banks</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="space-y-2">
                    {banks.map((bank) => (
                        <li key={bank.id} className="border p-3 rounded-md">
                            <p>Address: {toHex(BigInt(bank.id))}</p>
                            <p>Token ID: {bank.tokenId}</p>
                            <p>Total Distributed: {bank.totalDistributed}</p>
                            <p>Total Claimed: {bank.totalClaimed}</p>
                            <p>
                                Distribution Status:{" "}
                                {bank.isDistributing ? "Active" : "Inactive"}
                            </p>
                        </li>
                    ))}
                </ul>
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
                </CardHeader>
                <CardContent>
                    <p>No interaction contracts associated with this product</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Interaction Contracts</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="space-y-2">
                    {contracts.map((contract) => (
                        <li key={contract.id} className="border p-3 rounded-md">
                            <p>Address: {toHex(BigInt(contract.id))}</p>
                            <p>Referral Tree: {contract.referralTree}</p>
                            <p>
                                Created:{" "}
                                {new Date(
                                    Number(contract.createdTimestamp) * 1000
                                ).toLocaleDateString()}
                            </p>
                            <p>
                                Last Updated:{" "}
                                {contract.lastUpdateTimestamp
                                    ? new Date(
                                          Number(contract.lastUpdateTimestamp) *
                                              1000
                                      ).toLocaleDateString()
                                    : "Never"}
                            </p>
                            {contract.removedTimestamp && (
                                <p>
                                    Removed:{" "}
                                    {contract.removedTimestamp
                                        ? new Date(
                                              Number(
                                                  contract.removedTimestamp
                                              ) * 1000
                                          ).toLocaleDateString()
                                        : "Active"}
                                </p>
                            )}
                        </li>
                    ))}
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
                </CardHeader>
                <CardContent>
                    <p>No administrators associated with this product</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Administrators</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="space-y-2">
                    {administrators.map((admin) => (
                        <li key={admin.user} className="border p-3 rounded-md">
                            <p>User: {admin.user}</p>
                            <p>
                                Role:{" "}
                                {admin.isOwner ? "Owner" : "Administrator"}
                            </p>
                            <p>Roles: {admin.roles}</p>
                            <p>
                                Created:{" "}
                                {new Date(
                                    Number(admin.createdTimestamp) * 1000
                                ).toLocaleDateString()}
                            </p>
                        </li>
                    ))}
                </ul>
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
                </CardHeader>
                <CardContent>
                    <p>No campaigns associated with this product</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
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
                            <TableRow key={campaign.id}>
                                <TableCell>{campaign.name}</TableCell>
                                <TableCell>{campaign.type}</TableCell>
                                <TableCell>{campaign.version}</TableCell>
                                <TableCell>
                                    {campaign.attached
                                        ? "Attached"
                                        : "Detached"}
                                </TableCell>
                                <TableCell>
                                    {toHex(BigInt(campaign.id))}
                                </TableCell>
                                <TableCell>
                                    {toHex(BigInt(campaign.bankingContractId))}
                                </TableCell>
                                <TableCell>
                                    {campaign.isAuthorisedOnBanking
                                        ? "Authorized"
                                        : "Unauthorized"}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
