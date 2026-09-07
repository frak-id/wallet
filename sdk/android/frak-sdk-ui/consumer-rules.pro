# Consumer R8 / ProGuard rules for `id.frak.sdk:ui`.
#
# Like the core module's file, these ship inside the AAR and R8 merges them into the merchant
# app automatically — nothing to paste.
#
# Still empty, and expected to stay that way.
#
# No `@JavascriptInterface` keep: there is no WebView bridge, and there must not be one. State
# goes in as query parameters and comes out as an intercepted result URL, so nothing in the
# sheet is reached reflectively.
