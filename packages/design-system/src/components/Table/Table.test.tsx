import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "./index";

function renderTable() {
    return render(
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Wallet</TableHead>
                    <TableHead hug>Role</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow>
                    <TableCell>0x1234</TableCell>
                    <TableCell align="right" hug>
                        Owner
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
    );
}

describe("Table", () => {
    it("renders semantic table elements", () => {
        renderTable();
        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(
            screen.getByRole("columnheader", { name: "Wallet" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("cell", { name: "0x1234" })
        ).toBeInTheDocument();
    });

    it("sets scope=col on header cells", () => {
        renderTable();
        expect(
            screen.getByRole("columnheader", { name: "Role" })
        ).toHaveAttribute("scope", "col");
    });

    it("applies different classes for align variants", () => {
        const { rerender } = render(
            <table>
                <tbody>
                    <tr>
                        <TableCell>x</TableCell>
                    </tr>
                </tbody>
            </table>
        );
        const leftClass = screen.getByRole("cell").className;

        rerender(
            <table>
                <tbody>
                    <tr>
                        <TableCell align="right">x</TableCell>
                    </tr>
                </tbody>
            </table>
        );
        expect(screen.getByRole("cell").className).not.toBe(leftClass);
    });

    it("forwards native props like colSpan", () => {
        render(
            <table>
                <tbody>
                    <tr>
                        <TableCell colSpan={3} muted>
                            empty
                        </TableCell>
                    </tr>
                </tbody>
            </table>
        );
        expect(screen.getByRole("cell")).toHaveAttribute("colspan", "3");
    });
});
