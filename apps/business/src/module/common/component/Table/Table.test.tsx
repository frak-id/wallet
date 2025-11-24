import { createColumnHelper } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table } from "./index";

type TestData = {
    id: number;
    name: string;
    value: number;
};

const columnHelper = createColumnHelper<TestData>();

describe("Table", () => {
    const columns = [
        columnHelper.accessor("name", {
            header: "Name",
        }),
        columnHelper.accessor("value", {
            header: "Value",
        }),
    ];

    it("should render table with data", () => {
        const data: TestData[] = [
            { id: 1, name: "Item 1", value: 10 },
            { id: 2, name: "Item 2", value: 20 },
        ];

        render(<Table data={data} columns={columns} />);

        expect(screen.getByText("Item 1")).toBeInTheDocument();
        expect(screen.getByText("Item 2")).toBeInTheDocument();
        expect(screen.getByText("10")).toBeInTheDocument();
        expect(screen.getByText("20")).toBeInTheDocument();
    });

    it("should render table headers", () => {
        const data: TestData[] = [];

        render(<Table data={data} columns={columns} />);

        expect(screen.getByText("Name")).toBeInTheDocument();
        expect(screen.getByText("Value")).toBeInTheDocument();
    });

    it("should render no results message when data is empty", () => {
        const data: TestData[] = [];

        render(<Table data={data} columns={columns} />);

        expect(screen.getByText("No results")).toBeInTheDocument();
    });

    it("should render preTable content", () => {
        const data: TestData[] = [{ id: 1, name: "Item", value: 10 }];

        render(
            <Table
                data={data}
                columns={columns}
                preTable={<div data-testid="pre-table">Pre content</div>}
            />
        );

        expect(screen.getByTestId("pre-table")).toBeInTheDocument();
    });

    it("should render postTable content", () => {
        const data: TestData[] = [{ id: 1, name: "Item", value: 10 }];

        render(
            <Table
                data={data}
                columns={columns}
                postTable={<div data-testid="post-table">Post content</div>}
            />
        );

        expect(screen.getByTestId("post-table")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        const data: TestData[] = [{ id: 1, name: "Item", value: 10 }];

        const { container } = render(
            <Table data={data} columns={columns} className="custom-table" />
        );

        const table = container.querySelector("table");
        expect(table?.className).toContain("custom-table");
    });
});
