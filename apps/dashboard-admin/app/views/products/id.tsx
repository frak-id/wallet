import { ProductInfo } from "~/module/product/component/ProductInfo";
import type { Route } from "./+types/id";

/**
 * Receive the id as path param and render the product details
 * @returns
 */
export default function Product({ params: { id } }: Route.ComponentProps) {
    if (!id) {
        return <div>No id provided</div>;
    }

    return <ProductInfo id={id} />;
}
