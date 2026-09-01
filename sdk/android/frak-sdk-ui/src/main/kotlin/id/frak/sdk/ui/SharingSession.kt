package id.frak.sdk.ui

import android.webkit.WebView

/**
 * Resolved once before anything can be shown. [link] is local and always usable; a null page URL
 * is the tier-3 fallback (native share sheet, no page), not a broken session.
 *
 * [shareTitle]/[shareText] are tier-3 fallback copy only; a session with a page reports its own.
 */
internal class SharingSession(
    val returnScheme: String,
    val link: String,
    val shareTitle: String?,
    val shareText: String? = null,
    private val pageUrl: String?,
    /** The warm page this session's params can be hung off, if the view is actually showing it. */
    val warmBaseUrl: String? = null,
    private val activationFragment: String? = null,
) {
    val hasPage: Boolean get() = pageUrl != null

    /** How the view should get to this session's page. Null when [hasPage] is false. */
    fun navigation(
        confirmed: Boolean,
        currentBaseUrl: String? = null,
    ): SharingNavigation? {
        val full = pageUrl?.let { if (confirmed) "$it&view=confirmation" else it } ?: return null
        val warm = warmBaseUrl
        val fragment = activationFragment
        if (warm != null && fragment != null && currentBaseUrl == warm) {
            return SharingNavigation.Activate(
                fragment = if (confirmed) "$fragment&view=confirmation" else fragment,
                fullUrl = full,
            )
        }
        return SharingNavigation.Load(full)
    }

    /** Test/diagnostic view of [navigation]'s full-load answer. */
    fun url(confirmed: Boolean): String? = (navigation(confirmed) as? SharingNavigation.Load)?.url
}

/**
 * How to get the page in front of the user. A warmed document's URL is not the URL it was warmed
 * on — the page's router normalises its own search params on load — so an activation is a fragment
 * change on whatever is committed, never a rebuilt URL.
 */
internal sealed interface SharingNavigation {
    data class Load(
        val url: String,
    ) : SharingNavigation

    /** A fragment set on whatever document is loaded, which is the only same-document option. */
    data class Activate(
        val fragment: String,
        val fullUrl: String,
    ) : SharingNavigation
}

/**
 * Performs a [SharingNavigation]. The activation case hangs the fragment off the committed URL
 * rather than the one the view was warmed with — the page rewrites its own search params on load,
 * so they differ, and only a fragment-only change resolves same-document.
 */
internal fun WebView.navigate(navigation: SharingNavigation) {
    when (navigation) {
        is SharingNavigation.Load -> {
            loadUrl(navigation.url)
        }

        is SharingNavigation.Activate -> {
            val committed = url?.substringBefore('#')
            if (committed != null) {
                loadUrl(committed + navigation.fragment)
            } else {
                // Nothing loaded to hang a fragment off; load the page rather than leave a skeleton.
                loadUrl(navigation.fullUrl)
            }
        }
    }
}
