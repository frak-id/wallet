package android.webkit

/**
 * [RenderProcessGoneDetail] is abstract and the shipped SDK's stub throws from every method.
 * Neither value is read: the client's override ignores `detail` entirely.
 */
internal class FakeRenderProcessGoneDetail : RenderProcessGoneDetail() {
    override fun didCrash(): Boolean = true

    override fun rendererPriorityAtExit(): Int = 0
}
