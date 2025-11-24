import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "./index";

vi.mock("cmdk", () => ({
    Command: Object.assign(
        ({ children, className, ...props }: any) => (
            <div data-testid="command" className={className} {...props}>
                {children}
            </div>
        ),
        {
            Input: ({ className, ...props }: any) => (
                <input
                    data-testid="command-input"
                    className={className}
                    {...props}
                />
            ),
            List: ({ className, ...props }: any) => (
                <div
                    data-testid="command-list"
                    className={className}
                    {...props}
                />
            ),
            Empty: ({ className, ...props }: any) => (
                <div
                    data-testid="command-empty"
                    className={className}
                    {...props}
                />
            ),
            Group: ({ className, ...props }: any) => (
                <div
                    data-testid="command-group"
                    className={className}
                    {...props}
                />
            ),
            Item: ({ className, ...props }: any) => (
                <div
                    data-testid="command-item"
                    className={className}
                    {...props}
                />
            ),
            Separator: ({ className, ...props }: any) => (
                <div
                    data-testid="command-separator"
                    className={className}
                    {...props}
                />
            ),
        }
    ),
}));

describe("Command", () => {
    it("should render children", () => {
        render(
            <Command>
                <div>Command content</div>
            </Command>
        );

        expect(screen.getByText("Command content")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        const { container } = render(
            <Command className="custom-command">
                <div>Content</div>
            </Command>
        );

        const command = container.querySelector('[data-testid="command"]');
        expect(command?.className).toContain("custom-command");
    });
});

describe("CommandInput", () => {
    it("should render input", () => {
        render(<CommandInput />);

        expect(screen.getByTestId("command-input")).toBeInTheDocument();
    });

    it("should render search icon", () => {
        const { container } = render(<CommandInput />);

        const svg = container.querySelector("svg");
        expect(svg).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        render(<CommandInput className="custom-input" />);

        const input = screen.getByTestId("command-input");
        expect(input.className).toContain("custom-input");
    });
});

describe("CommandList", () => {
    it("should render list", () => {
        render(<CommandList />);

        expect(screen.getByTestId("command-list")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        render(<CommandList className="custom-list" />);

        const list = screen.getByTestId("command-list");
        expect(list.className).toContain("custom-list");
    });
});

describe("CommandEmpty", () => {
    it("should render empty state", () => {
        render(<CommandEmpty />);

        expect(screen.getByTestId("command-empty")).toBeInTheDocument();
    });
});

describe("CommandGroup", () => {
    it("should render group", () => {
        render(<CommandGroup />);

        expect(screen.getByTestId("command-group")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        render(<CommandGroup className="custom-group" />);

        const group = screen.getByTestId("command-group");
        expect(group.className).toContain("custom-group");
    });
});

describe("CommandItem", () => {
    it("should render item", () => {
        render(<CommandItem>Item content</CommandItem>);

        expect(screen.getByTestId("command-item")).toBeInTheDocument();
        expect(screen.getByText("Item content")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        render(<CommandItem className="custom-item" />);

        const item = screen.getByTestId("command-item");
        expect(item.className).toContain("custom-item");
    });
});

describe("CommandSeparator", () => {
    it("should render separator", () => {
        render(<CommandSeparator />);

        expect(screen.getByTestId("command-separator")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
        render(<CommandSeparator className="custom-separator" />);

        const separator = screen.getByTestId("command-separator");
        expect(separator.className).toContain("custom-separator");
    });
});
