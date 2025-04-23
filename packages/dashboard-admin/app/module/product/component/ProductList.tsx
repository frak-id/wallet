import { productTypesMask } from "@frak-labs/core-sdk";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "~/module/common/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "~/module/common/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/module/common/components/ui/table";
import { type MappedProduct, useGetAllProduct } from "../hook/useGetAllProduct";

interface ProductListProps {
    limit?: number;
}

export function ProductList({ limit }: ProductListProps) {
    const { products, isLoading } = useGetAllProduct();
    const [searchTerm, setSearchTerm] = useState("");

    if (isLoading) {
        return (
            <div className="py-10 text-center text-muted-foreground">
                <div className="animate-pulse">Loading products...</div>
            </div>
        );
    }

    if (!products?.length) {
        return (
            <div className="py-10 text-center text-muted-foreground">
                <p>No products found</p>
                <Button className="mt-4">Create a Product</Button>
            </div>
        );
    }

    const filteredProducts = searchTerm
        ? products.filter(
              (product) =>
                  product.name
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase()) ||
                  product.domain
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase())
          )
        : products;

    const displayedProducts = limit
        ? filteredProducts.slice(0, limit)
        : filteredProducts;

    return (
        <Card>
            <CardHeader className="flex-row flex items-center justify-between pb-4">
                <CardTitle>Products</CardTitle>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search products..."
                            className="px-3 py-2 text-sm border rounded-md w-[200px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="font-medium">
                                    Name
                                </TableHead>
                                <TableHead className="font-medium">
                                    Domain
                                </TableHead>
                                <TableHead className="font-medium">
                                    Types
                                </TableHead>
                                <TableHead className="font-medium">
                                    Created
                                </TableHead>
                                <TableHead className="text-right" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayedProducts.map((product) => (
                                <ProductRow
                                    key={product.id}
                                    product={product}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

function ProductRow({ product }: { product: MappedProduct }) {
    const productTypes = Object.entries(productTypesMask)
        .filter(([_, value]) => (product.productTypes & value) !== BigInt(0))
        .map(([key]) => key);

    const readableCreationDate = new Date(
        Number(product.createTimestamp) * 1000
    ).toLocaleDateString();

    return (
        <TableRow className="hover:bg-muted/50">
            <TableCell className="font-medium">{product.name}</TableCell>
            <TableCell className="text-muted-foreground">
                {product.domain}
            </TableCell>
            <TableCell>
                <div className="flex flex-wrap gap-1">
                    {productTypes.map((type) => (
                        <span
                            key={type}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                        >
                            {type}
                        </span>
                    ))}
                </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
                {readableCreationDate}
            </TableCell>
            <TableCell className="text-right">
                <Button asChild size="sm" variant="outline">
                    <Link to={`/product/${product.id}`}>View Details</Link>
                </Button>
            </TableCell>
        </TableRow>
    );
}
