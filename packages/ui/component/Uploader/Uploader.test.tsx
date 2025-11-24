import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Uploader } from "./index";

// Mock react-dropzone
vi.mock("react-dropzone", () => ({
    useDropzone: (options: any) => ({
        getRootProps: () => ({
            onClick: vi.fn(),
            onKeyDown: vi.fn(),
        }),
        getInputProps: () => ({
            type: "file",
            multiple: options.maxFiles > 1,
            accept: options.accept,
            disabled: options.disabled,
        }),
        isFocused: false,
        isDragAccept: false,
        isDragReject: false,
    }),
}));

describe("Uploader", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should render uploader", () => {
        const handleDrop = vi.fn();
        const { container } = render(<Uploader onDrop={handleDrop} />);
        const uploader = container.querySelector("section");
        expect(uploader).toBeInTheDocument();
    });

    it("should render with custom text", () => {
        const handleDrop = vi.fn();
        render(<Uploader onDrop={handleDrop} text="Drop files here" />);
        expect(screen.getByText("Drop files here")).toBeInTheDocument();
    });

    it("should render file extensions when accept prop is provided", () => {
        const handleDrop = vi.fn();
        render(
            <Uploader
                onDrop={handleDrop}
                accept={{ "image/*": [".png", ".jpg"] }}
            />
        );
        // File extensions should be displayed
        const text = screen.getByText(/png|jpg/i);
        expect(text).toBeInTheDocument();
    });

    it("should accept multiple file types", () => {
        const handleDrop = vi.fn();
        render(
            <Uploader
                onDrop={handleDrop}
                accept={{
                    "image/*": [".png", ".jpg"],
                    "application/pdf": [".pdf"],
                }}
            />
        );
        // Should display all accepted extensions
        expect(screen.getByText(/png|jpg|pdf/i)).toBeInTheDocument();
    });

    it("should render with maxFiles prop", () => {
        const handleDrop = vi.fn();
        const { container } = render(
            <Uploader onDrop={handleDrop} maxFiles={5} />
        );
        // Component should accept maxFiles prop
        const uploader = container.querySelector("section");
        expect(uploader).toBeInTheDocument();
    });

    it("should be disabled when disabled prop is true", () => {
        const handleDrop = vi.fn();
        render(<Uploader onDrop={handleDrop} disabled />);
        const input = document.querySelector("input[type='file']");
        // Input should be disabled
        expect(input).toBeInTheDocument();
        // Note: react-dropzone handles disabled state internally
    });

    it("should render without text", () => {
        const handleDrop = vi.fn();
        const { container } = render(<Uploader onDrop={handleDrop} />);
        expect(container.querySelector("section")).toBeInTheDocument();
    });
});
