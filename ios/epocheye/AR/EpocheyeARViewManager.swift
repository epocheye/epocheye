import Foundation
import UIKit

@objc(EpocheyeARViewManager)
final class EpocheyeARViewManager: RCTViewManager {

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func view() -> UIView! {
    return EpocheyeARView()
  }
}
