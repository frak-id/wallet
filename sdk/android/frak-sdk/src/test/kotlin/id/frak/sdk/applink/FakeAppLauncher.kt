package id.frak.sdk.applink

/** [AppLauncher] with no `PackageManager` underneath, recording what was opened. */
internal class FakeAppLauncher(
    var installedPackages: Set<String> = emptySet(),
    /** Whether an open succeeds — a device with nothing willing to handle the URL. */
    var canOpen: Boolean = true,
) : AppLauncher {
    val opened: MutableList<String> = mutableListOf()

    override fun isInstalled(packageId: String): Boolean = packageId in installedPackages

    override fun open(url: String): Boolean {
        if (!canOpen) return false
        opened += url
        return true
    }
}
