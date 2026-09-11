import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
    DrawerTrigger,
} from "./index";

describe("Drawer", () => {
    it("should render the trigger", () => {
        render(
            <Drawer>
                <DrawerTrigger>Open drawer</DrawerTrigger>
            </Drawer>
        );
        expect(screen.getByText("Open drawer")).toBeInTheDocument();
    });

    it("should render content, title and description when controlled open", async () => {
        render(
            <Drawer open>
                <DrawerContent hideHandle>
                    <DrawerTitle>Drawer title</DrawerTitle>
                    <DrawerDescription>Drawer description</DrawerDescription>
                    <p>Body content</p>
                </DrawerContent>
            </Drawer>
        );
        expect(await screen.findByText("Drawer title")).toBeInTheDocument();
        expect(screen.getByText("Drawer description")).toBeInTheDocument();
        expect(screen.getByText("Body content")).toBeInTheDocument();
    });
});
