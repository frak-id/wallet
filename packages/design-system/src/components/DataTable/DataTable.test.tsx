import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createDataTableColumnHelper, DataTable } from "./index";

type TestData = {
    id: number;
    name: string;
    value: number;
};

const columnHelper = createDataTableColumnHelper<TestData>();

const EMPTY_MESSAGE = "No results found";

describe("DataTable", () => {
    const columns = columnHelper.columns([
        columnHelper.accessor("name", {
            header: "Name",
        }),
        columnHelper.accessor("value", {
            header: "Value",
        }),
    ]);

    it("should render table with data", () => {
        const data: TestData[] = [
            { id: 1, name: "Item 1", value: 10 },
            { id: 2, name: "Item 2", value: 20 },
        ];

        render(
            <DataTable
                data={data}
                columns={columns}
                emptyMessage={EMPTY_MESSAGE}
            />
        );

        expect(screen.getByText("Item 1")).toBeInTheDocument();
        expect(screen.getByText("Item 2")).toBeInTheDocument();
        expect(screen.getByText("10")).toBeInTheDocument();
        expect(screen.getByText("20")).toBeInTheDocument();
    });

    it("should render table headers", () => {
        const data: TestData[] = [];

        render(
            <DataTable
                data={data}
                columns={columns}
                emptyMessage={EMPTY_MESSAGE}
            />
        );

        expect(screen.getByText("Name")).toBeInTheDocument();
        expect(screen.getByText("Value")).toBeInTheDocument();
    });

    it("should render the empty message when data is empty", () => {
        const data: TestData[] = [];

        render(
            <DataTable
                data={data}
                columns={columns}
                emptyMessage={EMPTY_MESSAGE}
            />
        );

        expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument();
    });

    it("should render preTable content", () => {
        const data: TestData[] = [{ id: 1, name: "Item", value: 10 }];

        render(
            <DataTable
                data={data}
                columns={columns}
                emptyMessage={EMPTY_MESSAGE}
                preTable={<div data-testid="pre-table">Pre content</div>}
            />
        );

        expect(screen.getByTestId("pre-table")).toBeInTheDocument();
    });

    it("should render postTable content", () => {
        const data: TestData[] = [{ id: 1, name: "Item", value: 10 }];

        render(
            <DataTable
                data={data}
                columns={columns}
                emptyMessage={EMPTY_MESSAGE}
                postTable={<div data-testid="post-table">Post content</div>}
            />
        );

        expect(screen.getByTestId("post-table")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        const data: TestData[] = [{ id: 1, name: "Item", value: 10 }];

        const { container } = render(
            <DataTable
                data={data}
                columns={columns}
                emptyMessage={EMPTY_MESSAGE}
                className="custom-table"
            />
        );

        const table = container.querySelector("table");
        expect(table?.className).toContain("custom-table");
    });
});

describe("DataTable sorting", () => {
    const sortableColumns = columnHelper.columns([
        columnHelper.accessor("name", {
            header: "Name",
        }),
        columnHelper.accessor("value", {
            header: "Value",
            enableSorting: false,
        }),
    ]);

    function renderSortable() {
        const data: TestData[] = [
            { id: 1, name: "Charlie", value: 30 },
            { id: 2, name: "Alpha", value: 10 },
            { id: 3, name: "Bravo", value: 20 },
        ];

        return render(
            <DataTable
                data={data}
                columns={sortableColumns}
                emptyMessage={EMPTY_MESSAGE}
                enableSorting={true}
            />
        );
    }

    function getBodyRowTexts() {
        return screen
            .getAllByRole("row")
            .slice(1)
            .map((row) => row.textContent);
    }

    it("sorts ascending on first header click", async () => {
        const user = userEvent.setup();
        renderSortable();

        expect(getBodyRowTexts()).toEqual(["Charlie30", "Alpha10", "Bravo20"]);

        await user.click(screen.getByRole("button", { name: /Name/ }));

        expect(getBodyRowTexts()).toEqual(["Alpha10", "Bravo20", "Charlie30"]);
    });

    it("sorts descending on second header click", async () => {
        const user = userEvent.setup();
        renderSortable();
        const nameHeader = screen.getByRole("button", { name: /Name/ });

        await user.click(nameHeader);
        await user.click(nameHeader);

        expect(getBodyRowTexts()).toEqual(["Charlie30", "Bravo20", "Alpha10"]);
    });

    it("leaves row order unchanged for a non-sortable column", async () => {
        renderSortable();

        expect(
            screen.queryByRole("button", { name: /Value/ })
        ).not.toBeInTheDocument();

        const valueHeader = screen.getByText("Value");
        const user = userEvent.setup();
        await user.click(valueHeader);

        expect(getBodyRowTexts()).toEqual(["Charlie30", "Alpha10", "Bravo20"]);
    });

    it("sorts nullable numeric values with a custom comparator, nulls last in both directions", async () => {
        type NullableData = {
            id: number;
            label: string;
            score: number | null;
        };
        const nullableColumnHelper =
            createDataTableColumnHelper<NullableData>();
        const nullableColumns = nullableColumnHelper.columns([
            nullableColumnHelper.accessor("label", {
                header: "Label",
            }),
            nullableColumnHelper.accessor("score", {
                header: "Score",
                sortFn: (rowA, rowB) => {
                    const a = rowA.original.score;
                    const b = rowB.original.score;
                    if (a == null && b == null) return 0;
                    if (a == null) return 1;
                    if (b == null) return -1;
                    return a - b;
                },
            }),
        ]);
        const data: NullableData[] = [
            { id: 1, label: "Five", score: 5 },
            { id: 2, label: "NullA", score: null },
            { id: 3, label: "One", score: 1 },
            { id: 4, label: "NullB", score: null },
            { id: 5, label: "Three", score: 3 },
        ];

        const user = userEvent.setup();
        render(
            <DataTable
                data={data}
                columns={nullableColumns}
                emptyMessage={EMPTY_MESSAGE}
                enableSorting={true}
            />
        );

        const scoreHeader = screen.getByRole("button", { name: /Score/ });
        await user.click(scoreHeader);

        expect(getBodyRowTexts()).toEqual([
            "NullA",
            "NullB",
            "Five5",
            "Three3",
            "One1",
        ]);

        await user.click(scoreHeader);

        expect(getBodyRowTexts()).toEqual([
            "One1",
            "Three3",
            "Five5",
            "NullA",
            "NullB",
        ]);
    });
});

describe("DataTable filtering and auto-sort registration", () => {
    const autoColumns = columnHelper.columns([
        columnHelper.accessor("name", {
            header: "Name",
        }),
        columnHelper.accessor("value", {
            header: "Value",
        }),
    ]);

    function getBodyRowTexts() {
        return screen
            .getAllByRole("row")
            .slice(1)
            .map((row) => row.textContent);
    }

    it("filters rows on a column with no explicit filterFn", () => {
        const data: TestData[] = [
            { id: 1, name: "apple", value: 1 },
            { id: 2, name: "Banana", value: 2 },
            { id: 3, name: "cherry", value: 3 },
        ];

        render(
            <DataTable
                data={data}
                columns={autoColumns}
                emptyMessage={EMPTY_MESSAGE}
                enableFiltering={true}
                columnFilters={[{ id: "name", value: "an" }]}
            />
        );

        expect(getBodyRowTexts()).toEqual(["Banana2"]);
    });

    it("sorts a column with no explicit sortFn using natural, case-insensitive order", async () => {
        const user = userEvent.setup();
        const data: TestData[] = [
            { id: 1, name: "Item 10", value: 10 },
            { id: 2, name: "Item 9", value: 9 },
            { id: 3, name: "apple", value: 1 },
            { id: 4, name: "Banana", value: 2 },
        ];

        render(
            <DataTable
                data={data}
                columns={autoColumns}
                emptyMessage={EMPTY_MESSAGE}
                enableSorting={true}
            />
        );

        await user.click(screen.getByRole("button", { name: /Name/ }));

        expect(getBodyRowTexts()).toEqual([
            "apple1",
            "Banana2",
            "Item 99",
            "Item 1010",
        ]);
    });
});
