package id.frak.wallet

import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

class MainActivity : TauriActivity() {
  private var keepSplash = true

  override fun onCreate(savedInstanceState: Bundle?) {
    val splashScreen = installSplashScreen()
    splashScreen.setKeepOnScreenCondition { keepSplash }
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    window.decorView.setBackgroundColor(Color.parseColor("#FFFFFF"))

    // Safety timeout: dismiss splash after 5s even if JS never signals readiness
    Handler(Looper.getMainLooper()).postDelayed({ keepSplash = false }, 5000)
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
