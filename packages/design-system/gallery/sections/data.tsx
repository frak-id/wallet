import { Badge } from "@frak-labs/design-system/components/Badge";
import {
    createDataTableColumnHelper,
    DataTable,
} from "@frak-labs/design-system/components/DataTable";
import { StatCard } from "@frak-labs/design-system/components/StatCard";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@frak-labs/design-system/components/Table";
import { WalletIcon } from "@frak-labs/design-system/icons";
import { fixtures } from "../fixtures";
import { Case, Cases } from "../ui";

type Campaign = {
    name: string;
    status: "live" | "paused";
    rewards: number;
};

const campaigns: Campaign[] = [
    { name: "Spring referral", status: "live", rewards: 128 },
    { name: "Newsletter boost", status: "paused", rewards: 12 },
    { name: "Loyalty week", status: "live", rewards: 3045 },
];

const worstCampaigns: Campaign[] = [
    { name: fixtures.unbreakableEmail, status: "live", rewards: 1 },
    { name: fixtures.longSentence, status: "paused", rewards: 0 },
    { name: fixtures.nonLatin, status: "live", rewards: 9_999_999 },
];

const column = createDataTableColumnHelper<Campaign>();

const columns = column.columns([
    column.accessor("name", { header: "Campaign" }),
    column.accessor("status", {
        header: "Status",
        size: 96,
        cell: ({ getValue }) => (
            <Badge
                size="small"
                variant={getValue() === "live" ? "success" : "neutral"}
            >
                {getValue()}
            </Badge>
        ),
    }),
    column.accessor("rewards", {
        header: "Rewards",
        size: 96,
        meta: { align: "right" },
    }),
]);

const noop = () => {};

export function DataTableSection() {
    return (
        <>
            <Cases title="Rows" layout="stack">
                <Case name="default">
                    <DataTable
                        data={campaigns}
                        columns={columns}
                        emptyMessage="No campaigns"
                    />
                </Case>
                <Case name="clickable rows">
                    <DataTable
                        data={campaigns}
                        columns={columns}
                        emptyMessage="No campaigns"
                        onRowClick={noop}
                    />
                </Case>
                <Case name="sorted by rewards">
                    <DataTable
                        data={campaigns}
                        columns={columns}
                        emptyMessage="No campaigns"
                        enableSorting
                        sorting={[{ id: "rewards", desc: true }]}
                    />
                </Case>
            </Cases>
            <Cases title="Empty" layout="stack">
                <Case name="empty message">
                    <DataTable
                        data={[]}
                        columns={columns}
                        emptyMessage="No campaigns yet"
                    />
                </Case>
                <Case name="empty placeholder row">
                    <DataTable
                        data={[]}
                        columns={columns}
                        emptyMessage="No campaigns yet"
                        emptyPlaceholder="–"
                    />
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: long cells">
                    <DataTable
                        data={worstCampaigns}
                        columns={columns}
                        emptyMessage="No campaigns"
                    />
                </Case>
                <Case name="worst: long cells, fixed layout">
                    <DataTable
                        data={worstCampaigns}
                        columns={columns}
                        emptyMessage="No campaigns"
                        fixedLayout
                    />
                </Case>
                <Case name="worst: long empty message">
                    <DataTable
                        data={[]}
                        columns={columns}
                        emptyMessage={fixtures.longSentence}
                    />
                </Case>
            </Cases>
        </>
    );
}

type Invoice = { id: string; customer: string; amount: string };

const invoices: Invoice[] = [
    { id: "INV-001", customer: "Acme Store", amount: "€128.00" },
    { id: "INV-002", customer: "Globex", amount: "€12.50" },
];

const worstInvoices: Invoice[] = [
    {
        id: fixtures.singleChar,
        customer: fixtures.unbreakableEmail,
        amount: fixtures.hugeNumber,
    },
    {
        id: fixtures.hugeNumber,
        customer: fixtures.longSentence,
        amount: fixtures.singleChar,
    },
    { id: "INV-003", customer: fixtures.nonLatin, amount: fixtures.empty },
];

function InvoiceTable({
    rows,
    hug,
    empty,
}: {
    rows: Invoice[];
    hug?: boolean;
    empty?: string;
}) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead hug={hug}>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead align="right" hug={hug}>
                        Amount
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => (
                    <TableRow key={row.id}>
                        <TableCell hug={hug}>{row.id}</TableCell>
                        <TableCell>{row.customer}</TableCell>
                        <TableCell align="right" hug={hug}>
                            {row.amount}
                        </TableCell>
                    </TableRow>
                ))}
                {empty !== undefined && (
                    <TableRow>
                        <TableCell colSpan={3} align="center" muted>
                            {empty}
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}

export function TableSection() {
    return (
        <>
            <Cases title="Rows" layout="stack">
                <Case name="default">
                    <InvoiceTable rows={invoices} />
                </Case>
                <Case name="hugging columns">
                    <InvoiceTable rows={invoices} hug />
                </Case>
                <Case name="muted empty row">
                    <InvoiceTable rows={[]} empty="No invoices yet" />
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: long cells">
                    <InvoiceTable rows={worstInvoices} />
                </Case>
                <Case name="worst: long cells, hugging columns">
                    <InvoiceTable rows={worstInvoices} hug />
                </Case>
                <Case name="worst: long empty message">
                    <InvoiceTable rows={[]} empty={fixtures.longSentence} />
                </Case>
            </Cases>
        </>
    );
}

export function StatCardSection() {
    return (
        <>
            <Cases title="Variants">
                <Case name="default">
                    <StatCard amount="€1,284.00" label="Total earned" />
                </Case>
                <Case name="highlighted">
                    <StatCard
                        amount="€1,284.00"
                        label="Total earned"
                        highlighted
                    />
                </Case>
                <Case name="with icon">
                    <StatCard
                        amount="€84.20"
                        label="Available"
                        icon={<WalletIcon width={16} height={16} />}
                    />
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <StatCard
                        amount={fixtures.unbreakableEmail}
                        label={fixtures.unbreakableEmail}
                    />
                </Case>
                <Case name="worst: huge number">
                    <StatCard
                        amount={fixtures.hugeNumber}
                        label={fixtures.hugeNumber}
                        highlighted
                    />
                </Case>
                <Case name="worst: long sentence">
                    <StatCard
                        amount={fixtures.longSentence}
                        label={fixtures.longSentence}
                        icon={<WalletIcon width={16} height={16} />}
                    />
                </Case>
                <Case name="worst: one character">
                    <StatCard
                        amount={fixtures.singleChar}
                        label={fixtures.singleChar}
                    />
                </Case>
                <Case name="worst: non-Latin and emoji">
                    <StatCard
                        amount={fixtures.nonLatin}
                        label={fixtures.nonLatin}
                    />
                </Case>
            </Cases>
        </>
    );
}
