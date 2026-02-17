import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data, Form, useActionData, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const errors = loginErrorMessage(await login(request));

    return data({ errors });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const errors = loginErrorMessage(await login(request));

    return data({
        errors,
    });
};

export default function Auth() {
    const loaderData = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const [shop, setShop] = useState("");
    const { errors } = actionData || loaderData;

    return (
        <AppProvider embedded={false}>
            <s-page>
                <s-section>
                    <Form method="post">
                        <s-stack gap="base">
                            <s-heading>Log in</s-heading>
                            <s-text-field
                                name="shop"
                                label="Shop domain"
                                details="example.myshopify.com"
                                value={shop}
                                onChange={(e) => setShop(e.currentTarget.value)}
                                autocomplete="on"
                                error={errors.shop}
                            />
                            <s-button type="submit">Log in</s-button>
                        </s-stack>
                    </Form>
                </s-section>
            </s-page>
        </AppProvider>
    );
}
