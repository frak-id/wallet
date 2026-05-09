package id.frak.wallet

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import app.tauri.plugin.PluginManager

class MainActivity : TauriActivity() {
  private var keepSplash = true

  /**
   * Workaround for https://github.com/tauri-apps/tao/issues/1217.
   *
   * `tao 0.35.x` panics with `NullPtr("get_object_class")` inside
   * `tao::handle_intent` whenever the activity is created (cold start) or
   * receives a new intent (warm restart) carrying a VIEW/SEND payload —
   * i.e. every Android deep link. The panic aborts the process before
   * Crashlytics can initialise, matching the "instant crash, nothing
   * reported" symptom on QR scans / universal links.
   *
   * Tao reads the launch intent via `activity.getIntent()` in
   * `onActivityCreate`, and via the `intent` parameter in `onNewIntent`.
   * We swap a benign MAIN intent into both paths so tao's action filter
   * early-returns, then restore the real intent and hand it directly to
   * `tauri-plugin-deep-link` via the plugin manager — same hook tao would
   * have eventually triggered, minus the panic.
   *
   * Remove once we bump to a tao release that includes the fix and have
   * cycled `cargo update -p tao -p wry`.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    val splashScreen = installSplashScreen()
    splashScreen.setKeepOnScreenCondition { keepSplash }
    enableEdgeToEdge()

    val deepLink = intent.takeIf(::isDeepLinkIntent)
    if (deepLink != null) {
      intent = benignIntent()
    }

    super.onCreate(savedInstanceState)

    if (deepLink != null) {
      intent = deepLink
      PluginManager.onNewIntent(deepLink)
    }

    window.decorView.setBackgroundColor(Color.parseColor("#FFFFFF"))

    // Safety timeout: dismiss splash after 5s even if JS never signals readiness
    Handler(Looper.getMainLooper()).postDelayed({ keepSplash = false }, 5000)
  }

  override fun onNewIntent(intent: Intent) {
    if (isDeepLinkIntent(intent)) {
      super.onNewIntent(benignIntent())
      setIntent(intent)
      PluginManager.onNewIntent(intent)
    } else {
      super.onNewIntent(intent)
    }
  }

  private fun isDeepLinkIntent(intent: Intent?): Boolean = when (intent?.action) {
    Intent.ACTION_VIEW,
    Intent.ACTION_SEND,
    Intent.ACTION_SEND_MULTIPLE -> true
    else -> false
  }

  private fun benignIntent(): Intent = Intent(Intent.ACTION_MAIN).apply {
    addCategory(Intent.CATEGORY_LAUNCHER)
    setPackage(packageName)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.overScrollMode = View.OVER_SCROLL_NEVER
    webView.setBackgroundColor(Color.parseColor("#FFFFFF"))
    webView.addJavascriptInterface(SplashBridge(), "NativeSplash")
  }

  private inner class SplashBridge {
    @JavascriptInterface
    fun dismiss() {
      keepSplash = false
    }
  }
}
