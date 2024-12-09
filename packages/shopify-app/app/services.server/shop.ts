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

type FirstProductPublishedReturnType = {
    handle: string;
};

/**
 * Get the first product published
 */
export async function firstProductPublished({
    admin: { graphql },
}: AuthenticatedContext): Promise<FirstProductPublishedReturnType> {
    const response = await graphql(`
query GetFirstPublishedProduct {
  products(first: 1, query: "published_status:published") {
    edges {
      node {
        handle
      }
    }
  }
}`);
    const {
        data: { products },
    } = await response.json();

    return products.edges?.[0]?.node;
}
