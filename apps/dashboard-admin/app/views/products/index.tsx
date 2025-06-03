import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "~/module/common/components/ui/card";
import { ProductList } from "~/module/product/component/ProductList";
import type { Route } from "../../+types/root";

export function meta(_: Route.MetaArgs) {
    return [
        { title: "Frak Dashboard Admin" },
        {
            name: "description",
            content: "Administrative dashboard for Frak products",
        },
    ];
}

export default function Home() {
    return (
        <>
            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Products
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">--</div>
                        <p className="text-xs text-muted-foreground">
                            Across all categories
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">
                            Active Products
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">--</div>
                        <p className="text-xs text-muted-foreground">
                            Currently active and distributing
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Campaigns
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">--</div>
                        <p className="text-xs text-muted-foreground">
                            Across all products
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Products Section */}
            <div>
                <ProductList />
            </div>
        </>
    );
}
