package id.frak.sdk.ui

import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.ProductDetails
import id.frak.sdk.sharing.SharingProduct
import id.frak.sdk.sharing.SharingRequest

// Defaulted helpers over the SDK's Builders, so a test that cares about one field says one field.

internal fun sharingRequest(
    link: String? = null,
    products: List<SharingProduct> = emptyList(),
    targetInteraction: String? = null,
    placement: String? = null,
    logoUrl: String? = null,
): SharingRequest =
    SharingRequest
        .Builder()
        .link(link)
        .products(products)
        .targetInteraction(targetInteraction)
        .placement(placement)
        .logoUrl(logoUrl)
        .build()

internal fun sharingProduct(
    title: String,
    link: String,
    imageUrl: String? = null,
    utmContent: String? = null,
    details: ProductDetails? = null,
): SharingProduct =
    SharingProduct
        .Builder(title, link)
        .imageUrl(imageUrl)
        .utmContent(utmContent)
        .details(details)
        .build()

internal fun productDetails(
    productId: String? = null,
    sku: String? = null,
    name: String? = null,
    quantity: Double? = null,
    unitPrice: Double? = null,
    totalPrice: Double? = null,
): ProductDetails =
    ProductDetails
        .Builder()
        .productId(productId)
        .sku(sku)
        .name(name)
        .quantity(quantity)
        .unitPrice(unitPrice)
        .totalPrice(totalPrice)
        .build()

internal fun frakConfig(merchantId: String): FrakConfig = FrakConfig.Builder(merchantId).build()
