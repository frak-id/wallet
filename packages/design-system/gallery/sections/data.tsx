import { Badge } from "@frak-labs/design-system/components/Badge";
import {
    createDataTableColumnHelper,
    DataTable,
} from "@frak-labs/design-system/components/DataTable";
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
