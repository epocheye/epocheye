import ARKit
import Foundation

@objc(ARKitModule)
final class ARKitModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc(isAvailable:rejecter:)
  func isAvailable(_ resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(ARWorldTrackingConfiguration.isSupported)
  }

  @objc(isInstalled:rejecter:)
  func isInstalled(_ resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    // ARKit ships with iOS; availability == installed.
    resolve(ARWorldTrackingConfiguration.isSupported)
  }
}
