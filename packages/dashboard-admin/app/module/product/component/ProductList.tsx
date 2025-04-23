import { productTypesMask } from "@frak-labs/core-sdk";
import { Link } from "react-router";
import { Button } from "~/module/common/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/module/common/components/ui/table";
import { type MappedProduct, useGetAllProduct } from "../hook/useGetAllProduct";

export function ProductList() {
    const { products, isLoading } = useGetAllProduct();

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (!products?.length) {
        return <div>No products found</div>;
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Types</TableHead>
                    <TableHead>Created at</TableHead>
                    <TableHead />
                </TableRow>
            </TableHeader>
            <TableBody>
                {products.map((product) => (
                    <ProductRow key={product.id} product={product} />
                ))}
            </TableBody>
        </Table>
    );
}

function ProductRow({ product }: { product: MappedProduct }) {
    const productTypes = Object.entries(productTypesMask)
        .filter(([_, value]) => (product.productTypes & value) !== BigInt(0))
        .map(([key]) => key)
        .join(", ");
    const readableCreationDate = new Date(
        Number(product.createTimestamp) * 1000
    ).toLocaleDateString();

    return (
        <TableRow>
            <TableCell>{product.name}</TableCell>
            <TableCell>{product.domain}</TableCell>
            <TableCell>{productTypes}</TableCell>
            <TableCell>{readableCreationDate}</TableCell>
            <TableCell>
                <Button asChild>
                    <Link to={`/product/${product.id}`}>See more</Link>
                </Button>
            </TableCell>
        </TableRow>
    );
}
