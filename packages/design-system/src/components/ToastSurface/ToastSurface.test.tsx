import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToastSurface } from "./index";
import { placement, surface } from "./toastSurface.css";

describe("ToastSurface", () => {
    it("should render its children", () => {
        render(<ToastSurface>toast</ToastSurface>);
        expect(screen.getByText("toast")).toBeInTheDocument();
    });

    it("should apply the base surface class", () => {
        render(<ToastSurface>toast</ToastSurface>);
        expect(screen.getByText("toast").className).toContain(surface);
    });

    it("should default to the top-center placement", () => {
        render(<ToastSurface>toast</ToastSurface>);
        expect(screen.getByText("toast").className).toContain(
            placement["top-center"]
        );
    });

    it("should merge a custom className", () => {
        render(<ToastSurface className="extra">toast</ToastSurface>);
        expect(screen.getByText("toast").className).toContain("extra");
    });
});
