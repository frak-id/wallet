import type { AuthenticatedContext } from "app/types/context";

type ShopInfoReturnType = {
    name: string;
    url: string;
    myshopifyDomain: string;
};

/**
 * Get the shop name and url
 */
export async function shopInfo({
    admin: { graphql },
}: AuthenticatedContext): Promise<ShopInfoReturnType> {
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
