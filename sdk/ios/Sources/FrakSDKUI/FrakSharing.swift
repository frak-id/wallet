#if canImport(UIKit)
    import FrakSDK
    import SwiftUI
    import UIKit

    /// The Frak sharing sheet for a UIKit app. Build it once per screen, ``warm()`` it when a share
    /// affordance becomes visible, then ``present(_:)`` on the tap. SwiftUI apps use
    /// `View.frakSharingSheet(isPresented:request:)`; both drive one `SharingPresenter`.
    ///
    /// Hold the instance for as long as the screen lives: releasing it takes the warm web view.
    @MainActor
    public final class FrakSharing {
        /// How a sharing session ended. Called once per ``present(_:)``, on the main actor.
        public typealias ResultHandler = @MainActor (SharingResult) -> Void

        private weak var host: UIViewController?
        private let configuration: FrakSharingConfiguration
        private let onResult: ResultHandler
        private let presenter = SharingPresenter()
        private let dismissalObserver = DismissalObserver()

        /// The most significant outcome so far, so a user who swipes the sheet away after sharing
        /// is still reported as having shared.
        private var best: SharingResult?
        private weak var presented: UIViewController?

        /// - Parameters:
        ///   - host: the view controller the sheet is presented from. Held weakly; the sheet stops
        ///     working once it goes away, which is the same lifetime a screen-scoped instance wants.
        ///   - configuration: sheet height and which store surface the install step raises.
        ///   - onResult: called once per presentation with the most significant outcome.
        public init(
            presentingFrom host: UIViewController,
            configuration: FrakSharingConfiguration = FrakSharingConfiguration(),
            onResult: @escaping ResultHandler = { _ in }
        ) {
            self.host = host
            self.configuration = configuration
            self.onResult = onResult
            dismissalObserver.onDismiss = { [weak self] in self?.settle() }
        }

        deinit {
            // `presenter` is main-actor isolated and `deinit` is not, so the teardown is hopped
            // rather than called inline. Captured directly: `self` is already going away.
            let presenter = presenter
            Task { @MainActor in presenter.teardown() }
        }

        /// Starts warming the pooled web view and the identity/config reads. Call when a share
        /// affordance becomes visible; cheap to call repeatedly, and ``present(_:)`` implies it.
        public func warm() {
            Task { @MainActor in await presenter.warm(language: configuration.resolvedLanguage) }
        }

        /// Presents the sheet for `request`. A second call while a sheet is up is a no-op.
        public func present(_ request: SharingRequest) {
            guard let host, host.view.window != nil else {
                // No window means nothing can be presented from it, and reporting `.dismissed` for
                // a sheet that never opened would be a lie about a session that never started.
                return
            }
            guard presented == nil else { return }

            presenter.launch(
                request,
                install: configuration.install,
                detectInstall: configuration.detectInstall,
                language: configuration.resolvedLanguage,
                onOutcome: { [weak self] result in
                    guard let self else { return }
                    if result.significance > (self.best?.significance ?? -1) {
                        self.best = result
                    }
                },
                onClose: { [weak self] in self?.dismiss() }
            )

            let content = FrakSharingSheetContent(
                presenter: presenter,
                heightFraction: configuration.heightFraction
            )
            let controller = SharingHostingController(rootView: content)
            // Every way the sheet can leave, including the merchant popping the screen under it —
            // `presentationControllerDidDismiss` covers only the user's own swipe, so on its own it
            // loses the result for a session the merchant navigated away from.
            controller.onDismissed = { [weak self] in self?.settle() }
            controller.modalPresentationStyle = .pageSheet
            controller.presentationController?.delegate = dismissalObserver
            applyDetents(to: controller)

            presented = controller
            host.present(controller, animated: true) { [weak self] in
                self?.presenter.onPresented()
            }
        }

        /// `UISheetPresentationController` is iOS 15, but `.custom` detents are iOS 16. On 15 the
        /// nearest system detent stands in, which is closer than SwiftUI manages there — and the
        /// grabber is available on both, unlike SwiftUI's `presentationDragIndicator`.
        private func applyDetents(to controller: UIViewController) {
            guard let sheet = controller.sheetPresentationController else { return }
            sheet.prefersGrabberVisible = true
            let fraction = configuration.heightFraction
            if #available(iOS 16.0, *) {
                sheet.detents = [.custom { context in context.maximumDetentValue * fraction }]
            } else {
                sheet.detents = [fraction <= 0.6 ? .medium() : .large()]
            }
        }

        private func dismiss() {
            guard let presented else {
                // Closed before it was presented: still owed exactly one report.
                settle()
                return
            }
            presented.dismiss(animated: true) { [weak self] in self?.settle() }
        }

        /// The single exit, whether the sheet closed itself or the user swiped it away. The
        /// presenter refuses to report a session twice, so both paths can call this.
        private func settle() {
            presented = nil
            presenter.finish {
                onResult(best ?? .dismissed)
                best = nil
            }
        }

        /// Reports the sheet actually leaving the screen, which `UIHostingController` alone does
        /// not: `viewDidDisappear` also fires when the share chooser or the store sheet covers it,
        /// and settling there would report a session that is still running.
        private final class SharingHostingController<Content: View>: UIHostingController<Content> {
            var onDismissed: (@MainActor () -> Void)?

            override func viewDidDisappear(_ animated: Bool) {
                super.viewDidDisappear(animated)
                // Only a real dismissal detaches it from its presenter; being covered does not.
                guard isBeingDismissed || presentingViewController == nil else { return }
                onDismissed?()
            }
        }

        /// A delegate object rather than a conformance on `FrakSharing`: `UIKit` delegates are
        /// unowned-unsafe, and this one outlives the presentation it reports.
        private final class DismissalObserver: NSObject, UIAdaptivePresentationControllerDelegate {
            var onDismiss: (@MainActor () -> Void)?

            func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
                MainActor.assumeIsolated { onDismiss?() }
            }
        }
    }
#endif
