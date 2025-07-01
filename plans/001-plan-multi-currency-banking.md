# Plan: Multi-Currency Banking

This document outlines the implementation plan for introducing multi-currency banking into the Frak Wallet.

## 1. Backend Changes

### 1.1. Add New Stablecoin Addresses

In `packages/app-essentials/src/blockchain/addresses.ts`, add the new stablecoin addresses for EURe, GBPe, and USDe on Arbitrum. Also, create a new object to map the currency to the address.

```typescript
export const eureArbitrumAddress = "0x0c06cCF38114ddfc35e07427B9424adcca9F44F8";
export const gbpeArbitrumAddress = "0x2D80dBf04D0802abD7A342DaFA5d7cB42bfbb52f";
export const usdeArbitrumAddress = "0x0Fc041a4B6a3F634445804daAFD03f202337C125";

export const currencyToAddress = {
    EUR: eureArbitrumAddress,
    GBP: gbpeArbitrumAddress,
    USD: usdeArbitrumAddress,
};
```

### 1.2. Update `MintRepository` to Handle Different Currencies

In `services/backend/src/domain/business/repositories/MintRepository.ts`, modify the `mintProduct` function to accept a `currency` parameter. This parameter will determine which stablecoin to use for the bank.

The `mintProduct` function signature should be updated to:

```typescript
async mintProduct({
    name,
    domain,
    productTypes,
    owner,
    currency,
}: {
    name: string;
    domain: string;
    productTypes: ProductTypesKey[];
    owner: Address;
    currency: "USD" | "EUR" | "GBP";
})
```

Then, update the `deployUsdcBank` function to `deployBank` and make it accept a currency parameter.

```typescript
private async deployBank({
    productId,
    minter,
    lock,
    currency,
}: {
    productId: bigint;
    minter: LocalAccount;
    lock: Mutex;
    currency: "USD" | "EUR" | "GBP";
})
```

Inside `deployBank`, use the `currencyToAddress` object to select the correct stablecoin address based on the `currency` parameter.

```typescript
const tokenAddress = currencyToAddress[currency];

// ...

const { request, result } = await simulateContract(viemClient, {
    // ...
    args: [productId, tokenAddress],
});
```

The `deployMockedUsdBank` should also be updated to a generic `deployMockedBank` that can handle different currencies.

### 1.3. Update the Minting Endpoint

The API endpoint that triggers the minting process needs to be updated to accept the `currency` parameter and pass it to the `mintProduct` function.

## 2. RPC Layer Changes

### 2.1. Update `frak_getProductInformation`

The `frak_getProductInformation` RPC method should be updated to return the main currency of the product. The `GetProductInformationReturnType` in `sdk/core/src/types/rpc/productInformation.ts` should be updated to include a `currency` field.

```typescript
export type GetProductInformationReturnType = {
    // ...
    currency: "USD" | "EUR" | "GBP";
    // ...
};
```

## 3. Frontend Changes

### 3.1. Create a New Minting Page

In the business dashboard (`apps/dashboard`), create a new page for minting products. This page should include a form with the following fields:

-   Product Name
-   Domain
-   Product Types
-   Owner Address
-   Currency (a dropdown with USD, EUR, and GBP)

### 3.2. Update the Minting Logic

When the form is submitted, the frontend should call the updated minting endpoint with the selected currency.

### 3.3. Update the UI to Display the Main Currency

The frontend applications (`apps/wallet` and `apps/dashboard`) should be updated to display the main currency of the product. The `useGetProductInformation` hook can be used to get the currency.

## 4. Currency Rate Handling

### 4.1. Update the Pricing Repository

In `services/backend/src/common/repositories/PricingRepository.ts`, update the logic to handle the new currencies. When the input and output currencies are the same, the rate should be 1.

## 5. Testing

### 5.1. Update Existing Tests

Update the tests in `services/backend/src/domain/business/repositories/MintRepository.test.ts` to cover the new multi-currency functionality.

### 5.2. Add New Tests

Add new tests for the frontend to ensure the new minting page works as expected and the main currency is displayed correctly.
