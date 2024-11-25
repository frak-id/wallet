import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import {
    Button,
    Card,
    FormLayout,
    Page,
    AppProvider as PolarisAppProvider,
    Text,
    TextField,
} from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { useState } from "react";

import { login } from "../../shopify.server";

import { loginErrorMessage } from "./error.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const errors = loginErrorMessage(await login(request));

    return Response.json({ errors, polarisTranslations });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const errors = loginErrorMessage(await login(request));

    return Response.json({
        errors,
    });
};

export default function Auth() {
    const loaderData = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const [shop, setShop] = useState("");
    const { errors } = actionData || loaderData;

    return (
        <PolarisAppProvider i18n={loaderData.polarisTranslations}>
            <Page>
                <Card>
                    <Form method="post">
                        <FormLayout>
                            <Text variant="headingMd" as="h2">
                                Log in
                            </Text>
                            <TextField
                                type="text"
                                name="shop"
                                label="Shop domain"
                                helpText="example.myshopify.com"
                                value={shop}
                                onChange={setShop}
                                autoComplete="on"
                                error={errors.shop}
                            />
                            <Button submit>Log in</Button>
                        </FormLayout>
                    </Form>
                </Card>
            </Page>
        </PolarisAppProvider>
    );
}
