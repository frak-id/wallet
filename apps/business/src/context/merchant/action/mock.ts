import type { GetMerchantsResult } from "@/context/merchant/action/getMerchants";
import merchantsData from "@/mock/products.json";

export async function getMyMerchantsMock(): Promise<GetMerchantsResult> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return merchantsData as GetMerchantsResult;
}
