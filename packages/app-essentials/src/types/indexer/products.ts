export type GetAllProductsResponseDto = {
    id: string; // bigint under the hood
    domain: string;
    name: string;
    productTypes: string; // bigint under the hood
    createTimestamp: string; // bigint (timestamp)
}[];
