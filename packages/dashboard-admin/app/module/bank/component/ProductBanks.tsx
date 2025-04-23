import type { GetProductInfoResponseDto } from "@frak-labs/app-essentials";
import { formatUnits, toHex } from "viem";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/module/common/components/ui/card";
import { useToken } from "~/module/token/hook/useToken";

export function ProductBanksList({
    banks,
}: { banks: GetProductInfoResponseDto["banks"] }) {
    if (banks.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Banks</CardTitle>
                    <CardDescription>
                        Associated banking contracts
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <p className="text-muted-foreground italic">
                        No banks associated with this product
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Banks</CardTitle>
                <CardDescription>Associated banking contracts</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <ul className="space-y-4">
                    {banks.map((bank) => (
                        <BankRow key={bank.id} bank={bank} />
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}

function BankRow({
    bank,
}: { bank: GetProductInfoResponseDto["banks"][number] }) {
    const { token } = useToken(bank.tokenId);

    return (
        <li className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Bank Contract</h4>
                <div
                    className={`text-xs px-2 py-1 rounded-full ${bank.isDistributing ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}
                >
                    {bank.isDistributing ? "Distributing" : "Not Distributing"}
                </div>
            </div>
            <div className="space-y-2 text-sm">
                <p>
                    <span className="text-muted-foreground">Address:</span>{" "}
                    <span className="font-mono">{toHex(BigInt(bank.id))}</span>
                </p>
                <p>
                    <span className="text-muted-foreground">Token ID:</span>{" "}
                    {bank.tokenId}
                </p>
                {token && (
                    <p>
                        <span className="text-muted-foreground">
                            Token Name:
                        </span>{" "}
                        {token.name} - {token.symbol}
                    </p>
                )}
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t">
                    <div>
                        <p className="text-muted-foreground text-xs">
                            Total Distributed
                        </p>
                        {token ? (
                            <p className="font-medium">
                                {formatUnits(
                                    BigInt(bank.totalDistributed),
                                    token.decimals
                                )}
                            </p>
                        ) : (
                            <p className="font-medium">Loading...</p>
                        )}
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">
                            Total Claimed
                        </p>
                        {token ? (
                            <p className="font-medium">
                                {formatUnits(
                                    BigInt(bank.totalClaimed),
                                    token.decimals
                                )}
                            </p>
                        ) : (
                            <p className="font-medium">Loading...</p>
                        )}
                    </div>
                </div>
            </div>
        </li>
    );
}
