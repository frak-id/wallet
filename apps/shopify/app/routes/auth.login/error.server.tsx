import type { LoginError } from "@shopify/shopify-app-react-router/server";
import { LoginErrorType } from "@shopify/shopify-app-react-router/server";

type LoginErrorMessage = {
    shop?: "login.errors.missingShop" | "login.errors.invalidShop";
};

/** Returns the i18n key of the login error, translated by the route component. */
export function loginErrorMessage(loginErrors: LoginError): LoginErrorMessage {
    if (loginErrors?.shop === LoginErrorType.MissingShop) {
        return { shop: "login.errors.missingShop" };
    }
    if (loginErrors?.shop === LoginErrorType.InvalidShop) {
        return { shop: "login.errors.invalidShop" };
    }

    return {};
}
