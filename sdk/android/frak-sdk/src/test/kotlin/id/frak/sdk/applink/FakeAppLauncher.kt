package id.frak.sdk.applink

/** [AppLauncher] with no `PackageManager` underneath, recording what was opened. */
internal class FakeAppLauncher(
    /** What [isInstalled] reports. Independent of [openableSchemes]: the probe and the launch
     * are separate signals, and the whole point of not gating one on the other is that they
     * can disagree. */
    var installedPackages: Set<String> = emptySet(),
    /** Schemes something on the device handles, so `startActivity` finds a target. `http` and
     * `https` always resolve — a device always has a browser. */
    var openableSchemes: Set<String> = emptySet(),
    /** Whether an open succeeds at all — a device with nothing willing to handle the URL. */
    var canOpen: Boolean = true,
) : AppLauncher {
    val opened: MutableList<String> = mutableListOf()

    /** Parallel to [opened]: null means the launch was left open to any handler. */
    val openedPackages: MutableList<String?> = mutableListOf()

    override fun isInstalled(packageId: String): Boolean = packageId in installedPackages

    override fun open(
        url: String,
        packageId: String?,
    ): Boolean {
        if (!canOpen) return false
        if (!handles(url)) return false
        opened += url
        openedPackages += packageId
        return true
    }

    private fun handles(url: String): Boolean =
        url.startsWith("http://") ||
            url.startsWith("https://") ||
            openableSchemes.any { url.startsWith("$it://") }
}
