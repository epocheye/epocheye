import ARKit
import Foundation
import RealityKit
import UIKit

private enum Palette {
  static let cardFill = UIColor(white: 0.078, alpha: 0.92)
  static let amber = UIColor(red: 0xC9 / 255.0, green: 0xA8 / 255.0, blue: 0x4C / 255.0, alpha: 1.0)
  static let amberStroke = UIColor(red: 0xC9 / 255.0, green: 0xA8 / 255.0, blue: 0x4C / 255.0, alpha: 0.43)
  static let parchment = UIColor(red: 0xF5 / 255.0, green: 0xF0 / 255.0, blue: 0xE8 / 255.0, alpha: 1.0)
  static let muted = UIColor(red: 0xB8 / 255.0, green: 0xAF / 255.0, blue: 0x9E / 255.0, alpha: 1.0)
  static let warmGold = UIColor(red: 0xD4 / 255.0, green: 0xC5 / 255.0, blue: 0xA0 / 255.0, alpha: 1.0)
}

@objc(EpocheyeARView)
final class EpocheyeARView: UIView, ARSessionDelegate {

  // MARK: - React Native props

  @objc var identificationName: NSString? { didSet { updateCardContent() } }
  @objc var identificationPeriod: NSString? { didSet { updateCardContent() } }
  @objc var identificationSignificance: NSString? { didSet { updateCardContent() } }
  @objc var identificationFact: NSString? { didSet { updateCardContent() } }
  @objc var arEnabled: Bool = true { didSet { arView?.isHidden = !arEnabled } }

  @objc var onARReady: RCTDirectEventBlock?
  @objc var onCardTapped: RCTDirectEventBlock?
  @objc var onARError: RCTDirectEventBlock?

  // MARK: - Internal state

  private var arView: ARView?
  private var overlayCard: UIView?
  private var nameLabel: UILabel?
  private var periodLabel: UILabel?
  private var factLabel: UILabel?
  private var readyReported = false
  private var errorReported = false

  override init(frame: CGRect) {
    super.init(frame: frame)
    setupAR()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setupAR()
  }

  deinit {
    cleanup()
  }

  private func setupAR() {
    addOverlayCard()

    guard ARWorldTrackingConfiguration.isSupported else {
      reportError("ARKit world tracking not supported on this device")
      return
    }

    let view = ARView(frame: bounds)
    view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.automaticallyConfigureSession = false
    view.renderOptions.insert(.disableDepthOfField)
    view.renderOptions.insert(.disableMotionBlur)
    view.session.delegate = self

    let config = ARWorldTrackingConfiguration()
    config.planeDetection = [.horizontal]
    config.isAutoFocusEnabled = true
    if #available(iOS 13.0, *) {
      config.environmentTexturing = .automatic
    }

    view.session.run(config, options: [.resetTracking, .removeExistingAnchors])

    insertSubview(view, at: 0)
    arView = view
  }

  private func addOverlayCard() {
    guard overlayCard == nil else { return }

    let card = UIView()
    card.translatesAutoresizingMaskIntoConstraints = false
    card.backgroundColor = Palette.cardFill
    card.layer.cornerRadius = 20
    card.layer.borderWidth = 1
    card.layer.borderColor = Palette.amberStroke.cgColor
    card.isUserInteractionEnabled = true

    let tap = UITapGestureRecognizer(target: self, action: #selector(cardTapped))
    card.addGestureRecognizer(tap)

    let caption = UILabel()
    caption.translatesAutoresizingMaskIntoConstraints = false
    caption.attributedText = NSAttributedString(
      string: "AR PREVIEW",
      attributes: [
        .kern: 1.2,
        .foregroundColor: Palette.amber,
        .font: UIFont.systemFont(ofSize: 10, weight: .semibold),
      ]
    )

    let name = UILabel()
    name.translatesAutoresizingMaskIntoConstraints = false
    name.numberOfLines = 2
    name.font = UIFont.systemFont(ofSize: 18, weight: .semibold)
    name.textColor = Palette.parchment

    let period = UILabel()
    period.translatesAutoresizingMaskIntoConstraints = false
    period.font = UIFont.systemFont(ofSize: 12, weight: .medium)
    period.textColor = Palette.muted

    let fact = UILabel()
    fact.translatesAutoresizingMaskIntoConstraints = false
    fact.numberOfLines = 4
    fact.font = UIFont.systemFont(ofSize: 13, weight: .regular)
    fact.textColor = Palette.warmGold

    let stack = UIStackView(arrangedSubviews: [caption, name, period, fact])
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .vertical
    stack.spacing = 4
    stack.setCustomSpacing(4, after: caption)
    stack.setCustomSpacing(2, after: name)
    stack.setCustomSpacing(8, after: period)

    card.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 14),
      stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 18),
      stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18),
      stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16),
    ])

    addSubview(card)
    NSLayoutConstraint.activate([
      card.widthAnchor.constraint(equalToConstant: 280),
      card.centerXAnchor.constraint(equalTo: centerXAnchor),
      card.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor, constant: -40),
    ])

    overlayCard = card
    nameLabel = name
    periodLabel = period
    factLabel = fact

    updateCardContent()
  }

  private func updateCardContent() {
    nameLabel?.text = identificationName as String? ?? ""
    periodLabel?.text = identificationPeriod as String? ?? ""
    factLabel?.text = identificationFact as String? ?? ""
  }

  @objc private func cardTapped() {
    onCardTapped?([:])
  }

  private func reportError(_ message: String) {
    guard !errorReported else { return }
    errorReported = true
    onARError?(["error": message])
  }

  // MARK: - ARSessionDelegate

  func session(_ session: ARSession, didUpdate frame: ARFrame) {
    guard !readyReported else { return }
    if case .normal = frame.camera.trackingState {
      readyReported = true
      DispatchQueue.main.async { [weak self] in
        self?.onARReady?([:])
      }
    }
  }

  func session(_ session: ARSession, didFailWithError error: Error) {
    reportError(error.localizedDescription)
  }

  func cleanup() {
    arView?.session.pause()
    arView?.removeFromSuperview()
    arView = nil
    overlayCard?.removeFromSuperview()
    overlayCard = nil
    nameLabel = nil
    periodLabel = nil
    factLabel = nil
  }

  override func removeFromSuperview() {
    cleanup()
    super.removeFromSuperview()
  }
}
