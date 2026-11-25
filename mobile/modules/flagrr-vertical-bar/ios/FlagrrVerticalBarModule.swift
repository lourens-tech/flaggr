import ExpoModulesCore
import UIKit

// Reports the edge where iOS places the vertical bar: the strip down one side of
// the iPhone Duo's screens that holds the camera, the status items and, for apps
// using the system tab bar, the tabs. Read from `traitCollection.verticalBarEdge`
// (iOS 27.1+), which is "unspecified" on hardware that never shows the bar.
// "onChange" fires when the traits that affect the edge change.
public class FlagrrVerticalBarModule: Module {
  private weak var observedWindow: UIWindow?
  // A UITraitChangeRegistration (iOS 17+), kept type-erased so the class needs no availability.
  private var registration: AnyObject?

  public func definition() -> ModuleDefinition {
    Name("FlagrrVerticalBar")

    Events("onChange")

    AsyncFunction("getEdgeAsync") { () -> String in
      return MainActor.assumeIsolated {
        FlagrrVerticalBarModule.edge(of: FlagrrVerticalBarModule.currentWindow())
      }
    }.runOnQueue(.main)

    // Asks iOS to rebuild the vertical bar's contents. iOS reads them when the window first
    // appears; the system tab bar is mounted after that (once JavaScript has decided to use
    // it), and until something else changes, the strip would not show it.
    AsyncFunction("refreshAsync") { () -> Void in
      MainActor.assumeIsolated {
        FlagrrVerticalBarModule.requestVerticalBarUpdate()
      }
    }.runOnQueue(.main)

    OnStartObserving {
      Task { @MainActor in self.startObserving() }
    }

    OnStopObserving {
      Task { @MainActor in self.stopObserving() }
    }
  }

  @MainActor
  private func startObserving() {
    stopObserving()
    guard #available(iOS 27.1, *), let window = FlagrrVerticalBarModule.currentWindow() else { return }
    observedWindow = window
    registration = window.registerForTraitChanges(UITraitCollection.systemTraitsAffectingVerticalBarEdge) { [weak self] (changed: UIWindow, _: UITraitCollection) in
      self?.sendEvent("onChange", ["edge": FlagrrVerticalBarModule.edge(of: changed)])
    } as AnyObject
  }

  @MainActor
  private func stopObserving() {
    if #available(iOS 17.0, *), let registration = registration as? (any UITraitChangeRegistration), let window = observedWindow {
      window.unregisterForTraitChanges(registration)
    }
    registration = nil
    observedWindow = nil
  }

  // Workaround: react-native-screens attaches its UITabBarController when the host view
  // reaches the window, sized to the host's bounds at that moment (its fix for
  // software-mansion/react-native-screens#4989). On a fresh launch that host has not been
  // laid out yet, and UIKit does not rebuild the tab bar for the vertical bar until the
  // traits change (a fold or unfold). So: briefly flip each tab bar controller's horizontal
  // size class, which makes UIKit lay the bar out again, then ask for the vertical bar
  // configuration to be read again.
  @MainActor
  static func requestVerticalBarUpdate() {
    guard #available(iOS 27.1, *), let root = currentWindow()?.rootViewController else { return }
    var tabControllers: [UITabBarController] = []
    var stack: [UIViewController] = [root]
    while let vc = stack.popLast() {
      if let tabs = vc as? UITabBarController { tabControllers.append(tabs) }
      stack.append(contentsOf: vc.children)
      if let presented = vc.presentedViewController { stack.append(presented) }
    }
    for tabs in tabControllers {
      let current = tabs.traitCollection.horizontalSizeClass
      tabs.traitOverrides.horizontalSizeClass = current == .regular ? .compact : .regular
      DispatchQueue.main.async {
        tabs.traitOverrides.remove(UITraitHorizontalSizeClass.self)
        tabs.setNeedsUpdateOfVerticalBarConfiguration()
        root.setNeedsUpdateOfVerticalBarConfiguration()
      }
    }
  }

  @MainActor
  static func edge(of window: UIWindow?) -> String {
    guard let window else { return "unspecified" }
    if #available(iOS 27.1, *) {
      switch window.traitCollection.verticalBarEdge {
      case .leading: return "leading"
      case .trailing: return "trailing"
      default: return "unspecified"
      }
    }
    return "unspecified"
  }

  // The app's foreground window. There is no view of our own to read the trait
  // from, so this reads the window that hosts the React Native root view.
  @MainActor
  static func currentWindow() -> UIWindow? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
    return scene?.keyWindow ?? scene?.windows.first
  }
}
