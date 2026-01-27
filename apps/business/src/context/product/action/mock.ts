import type { GetProductResult } from "@/context/product/action/getProducts";
import productsData from "@/mock/products.json";

/**
 * Mock implementation of getMyProducts for demo mode
 * Returns mock product data with a realistic delay
 */
export async function getMyProductsMock(): Promise<GetProductResult> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Return the mock data with proper typing
    return productsData as GetProductResult;
}
