/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./index";

function renderTabs({
    defaultValue,
    onValueChange,
}: {
    defaultValue?: string;
    onValueChange?: (value: string) => void;
} = {}) {
    return render(
        <Tabs defaultValue={defaultValue} onValueChange={onValueChange}>
            <TabsList aria-label="Sections">
                <TabsTrigger value="account">Account</TabsTrigger>
                <TabsTrigger value="password">Password</TabsTrigger>
            </TabsList>
            <TabsContent value="account">Account panel</TabsContent>
            <TabsContent value="password">Password panel</TabsContent>
        </Tabs>
    );
}

describe("Tabs", () => {
    it("renders all triggers", () => {
        renderTabs();
        expect(
            screen.getByRole("tab", { name: "Account" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("tab", { name: "Password" })
        ).toBeInTheDocument();
    });

    it("marks the defaultValue trigger as active", () => {
        renderTabs({ defaultValue: "password" });
        const active = screen.getByRole("tab", { name: "Password" });
        expect(active).toHaveAttribute("data-state", "active");
    });

    it("shows only the active content panel", () => {
        renderTabs({ defaultValue: "account" });
        expect(screen.getByText("Account panel")).toBeVisible();
        expect(screen.queryByText("Password panel")).not.toBeInTheDocument();
    });

    it("switches state when a trigger is clicked", async () => {
        const user = userEvent.setup();
        renderTabs({ defaultValue: "account" });
        const passwordTrigger = screen.getByRole("tab", { name: "Password" });

        await user.click(passwordTrigger);

        expect(passwordTrigger).toHaveAttribute("data-state", "active");
        expect(screen.getByText("Password panel")).toBeVisible();
    });

    it("calls onValueChange with the new value", async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        renderTabs({ defaultValue: "account", onValueChange });

        await user.click(screen.getByRole("tab", { name: "Password" }));

        expect(onValueChange).toHaveBeenCalledWith("password");
    });

    it("forwards a custom className to TabsList", () => {
        render(
            <Tabs defaultValue="a">
                <TabsList className="custom-list" aria-label="X">
                    <TabsTrigger value="a">A</TabsTrigger>
                </TabsList>
            </Tabs>
        );
        const list = screen.getByRole("tablist", { name: "X" });
        expect(list.className).toContain("custom-list");
    });
});
