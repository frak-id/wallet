package id.frak.example.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import id.frak.example.android.ProductItem
import id.frak.example.android.formatCents

/**
 * The shopper-facing surface: what a merchant's own catalog screen would look like, with the three
 * sharing entry points a merchant can wire.
 */
@Composable
fun ShopTab(
    products: List<ProductItem>,
    catalogRewardLabel: String,
    currencyCode: String,
    onShareStore: () -> Unit,
    onShareProduct: (ProductItem) -> Unit,
    onShareCollection: () -> Unit,
) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            HarnessCard(
                title = "Reward for sharing",
                subtitle = "One lookup covers the whole catalog.",
                tinted = true,
            ) {
                Text(
                    text = catalogRewardLabel,
                    style = MaterialTheme.typography.titleLarge,
                    color = FrakTheme.textAction,
                )
            }
        }
        item {
            HarnessCard(
                title = "Share the whole store",
                subtitle = "No product attached — the link points at the store homepage.",
            ) {
                ActionButton(label = "Share the store", onClick = onShareStore)
            }
        }
        item {
            HarnessCard(
                title = "Share the Best Sellers collection",
                subtitle = "${products.size} products in one link, each with its own image.",
            ) {
                ActionButton(label = "Share ${products.size} products", onClick = onShareCollection)
            }
        }
        items(products) { product ->
            ProductRow(
                product = product,
                currencyCode = currencyCode,
                onShare = onShareProduct,
            )
        }
    }
}

@Composable
private fun ProductRow(
    product: ProductItem,
    currencyCode: String,
    onShare: (ProductItem) -> Unit,
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = FrakTheme.surfaceBackground2),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                // The image the SDK is handed for this row, so a tester can compare it against
                // what the sharing sheet draws.
                AsyncImage(
                    model = product.imageUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier =
                        Modifier
                            .size(72.dp)
                            .clip(RoundedCornerShape(8.dp)),
                )
                Column {
                    Text(
                        text = product.title,
                        style = MaterialTheme.typography.titleMedium,
                        color = FrakTheme.textPrimary,
                    )
                    Text(
                        text = formatCents(product.priceCents, currencyCode),
                        style = MaterialTheme.typography.bodyMedium,
                        color = FrakTheme.textPrimary,
                    )
                    Text(
                        text = product.id,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        color = FrakTheme.textSecondary,
                    )
                }
            }
            Spacer(modifier = Modifier.height(10.dp))
            ActionButton(label = "Share this product", onClick = { onShare(product) })
        }
    }
}
