package id.frak.wallet

import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    installSplashScreen()
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    // Set window background to match splash, prevents white flash before WebView loads
    window.decorView.setBackgroundColor(Color.parseColor("#001432"))
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.overScrollMode = View.OVER_SCROLL_NEVER
    webView.setBackgroundColor(Color.parseColor("#001432"))
  }
}
