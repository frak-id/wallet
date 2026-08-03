# Consumer R8 / ProGuard rules for `id.frak:frak-sdk-ui`.
#
# Like the core module's file, these ship INSIDE the AAR and R8 merges them into
# the merchant app automatically — nothing to paste (05 §4).
#
# Still empty, and expected to stay that way.
#
# An earlier version of this file anticipated a `@JavascriptInterface` keep for
# a WebView bridge. There is no bridge and there must not be one: 03 §2 forbids
# it outright, because state going in as query parameters and coming out as an
# intercepted result URL is precisely what lets this module skip the origin
# checks the `apps/listener` postMessage layer needed. Nothing in the sheet is
# reached reflectively, so R8 can see all of it.
