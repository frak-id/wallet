import SwiftUI

/// The two events a merchant reports back to Frak, each behind one button.
struct CheckoutTab: View {
    let currencyCode: String
    let onOrderCompleted: () -> Void
    let onSimulateDeepLink: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                HarnessCard(
                    title: "Complete a test order",
                    subtitle:
                        "Pretends the shopper just paid "
                        + "\(formatCents(sampleOrderTotalCents, currencyCode: currencyCode)) and reports it to Frak. "
                        + "Any reward earned lands on the wallet a few moments later."
                ) {
                    ActionButton(
                        label: "Complete order",
                        systemImage: "checkmark.circle.fill",
                        tint: .success,
                        action: onOrderCompleted
                    )
                }

                HarnessCard(
                    title: "Arrive from a shared link",
                    subtitle:
                        "Pretends the app was opened from a friend's referral link, so the next order "
                        + "is credited to them. Watch the event log for the result."
                ) {
                    ActionButton(
                        label: "Simulate a referral link",
                        systemImage: "link",
                        action: onSimulateDeepLink
                    )
                }

                HarnessCard(
                    title: "Test the real link instead",
                    subtitle:
                        "Open a link ending in ?fCtx=… from Messages or Safari to exercise the same path "
                        + "for real. The simulator above skips iOS's own routing."
                ) {
                    EmptyView()
                }
            }
        }
    }
}
