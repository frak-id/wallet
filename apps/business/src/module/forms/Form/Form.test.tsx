import { Input } from "@frak-labs/design-system/components/Input";
import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { Form, FormControl, FormField, FormItem, FormMessage } from "./index";

type Values = { email: string };

function Harness({ error }: { error?: string }) {
    const form = useForm<Values>({ defaultValues: { email: "" } });
    useEffect(() => {
        if (error) form.setError("email", { message: error });
    }, [error, form]);
    return (
        <Form {...form}>
            <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Input label="Email" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </Form>
    );
}

describe("FormControl accessibility wiring", () => {
    it("no error: describedby absent", () => {
        render(<Harness />);
        const input = screen.getByLabelText("Email");
        expect(input.getAttribute("aria-describedby")).toBeNull();
    });

    it("with error: describedby resolves to the message", async () => {
        render(<Harness error="Invalid email" />);
        const input = await screen.findByLabelText("Email");
        await screen.findByText("Invalid email");

        const desc = input.getAttribute("aria-describedby");
        expect(desc).not.toBeNull();
        expect(document.getElementById(desc as string)).not.toBeNull();
        expect(input).toHaveAccessibleDescription("Invalid email");
        expect(input.getAttribute("aria-invalid")).toBe("true");
    });
});
