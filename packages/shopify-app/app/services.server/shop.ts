import type { AuthenticatedContext } from "app/types/context";

/**
 * Get the shop name and url
 */
export async function shopInfo({ admin: { graphql } }: AuthenticatedContext) {
    const response = await graphql(`
query shopInfo {
  shop {
    name
    url
    myshopifyDomain
  }
}`);
    const {
        data: { shop },
    } = await response.json();

    return shop;
}
