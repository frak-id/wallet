import merchantsData from "@/mock/products.json";
import type { GetMerchantsResult } from "@/module/merchant/api/getMerchants";

export async function getMyMerchantsMock(): Promise<GetMerchantsResult> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return merchantsData as GetMerchantsResult;
}
