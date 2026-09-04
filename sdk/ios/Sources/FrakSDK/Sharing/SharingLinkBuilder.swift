import Foundation

/// Turns a merchant URL into a share link, and reads one back.
///
/// Entirely local: no network, no identity lookup, no clock beyond the timestamp the
/// caller already put in the context. That is what makes offline sharing work — the link
/// is correct, only the reward pitch around it is missing.
enum SharingLinkBuilder {
    /// The query parameter the referral context travels in.
    static let contextKey = "fCtx"
    /// Applied when nothing else names a source, so a link is never unattributed.
    private static let defaultSource = "frak"

    /// Nil when `baseURL` is not an http(s) URL, or the context carries no identity to encode.
    static func build(
        baseURL: String,
        context: FrakContext.V2,
        attribution: AttributionParams?,
        defaults: AttributionDefaults?,
        productUtmContent: String? = nil
    ) -> String? {
        // Scheme-checked, not just parseable: `URLQuery` accepts any `scheme://`, and a share
        // link is handed to the OS chooser — a vendor scheme would resolve there.
        guard isWebURL(baseURL), var url = URLQuery.parse(baseURL),
            let encoded = FrakContextCodec.compress(context)
        else {
            return nil
        }

        let resolved = merged(
            perCall: attribution,
            defaults: defaults,
            productUtmContent: productUtmContent
        )

        url.set(contextKey, to: encoded)
        // Gap-fill, never overwrite: a merchant's own `utm_source=newsletter` on a link they
        // already published must survive being shared.
        url.fillIfAbsent("utm_source", resolved.utmSource ?? defaultSource)
        url.fillIfAbsent("utm_medium", resolved.utmMedium)
        url.fillIfAbsent("utm_campaign", resolved.utmCampaign)
        url.fillIfAbsent("utm_content", resolved.utmContent)
        url.fillIfAbsent("utm_term", resolved.utmTerm)
        url.fillIfAbsent("via", resolved.via)
        url.fillIfAbsent("ref", resolved.ref)
        return url.string
    }

    /// The referral context in `url`, or nil when it carries none.
    private static func isWebURL(_ url: String) -> Bool {
        let lowered = url.lowercased()
        return lowered.hasPrefix("https://") || lowered.hasPrefix("http://")
    }

    static func parse(_ url: String) -> FrakContext? {
        URLQuery.parse(url)?.value(for: contextKey).flatMap(FrakContextCodec.decompress)
    }

    /// Per-call attribution wins over the merchant's resolved defaults, field by field.
    ///
    /// `utmContent` is the exception: it describes *what was shared*, so the product supplies
    /// it, the caller may override, and the merchant-level defaults never contribute.
    static func merged(
        perCall: AttributionParams?,
        defaults: AttributionDefaults?,
        productUtmContent: String? = nil
    ) -> AttributionParams {
        AttributionParams(
            utmSource: perCall?.utmSource ?? defaults?.utmSource,
            utmMedium: perCall?.utmMedium ?? defaults?.utmMedium,
            utmCampaign: perCall?.utmCampaign ?? defaults?.utmCampaign,
            utmContent: productUtmContent.flatMap { $0.isEmpty ? nil : $0 } ?? perCall?.utmContent,
            utmTerm: perCall?.utmTerm ?? defaults?.utmTerm,
            via: perCall?.via ?? defaults?.via,
            ref: perCall?.ref ?? defaults?.ref
        )
    }
}
