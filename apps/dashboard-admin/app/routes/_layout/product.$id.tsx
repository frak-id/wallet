import { createFileRoute } from "@tanstack/react-router";
import { ProductInfo } from "~/module/product/component/ProductInfo";

export const Route = createFileRoute("/_layout/product/$id")({
    component: ProductComponent,
});

function ProductComponent() {
    const { id } = Route.useParams();

    if (!id) {
        return <div>No id provided</div>;
    }

    return <ProductInfo id={id} />;
}
