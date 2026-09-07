package android.webkit

/** [WebResourceError]'s constructor is package-private; this fake lives in the same package to reach it. */
internal class FakeWebResourceError(
    private val code: Int = WebViewClient.ERROR_HOST_LOOKUP,
    private val message: String = "net::ERR_INTERNET_DISCONNECTED",
) : WebResourceError() {
    override fun getErrorCode(): Int = code

    override fun getDescription(): CharSequence = message
}
