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
