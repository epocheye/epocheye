module.exports = {
  // Only fonts need native asset linking. The TFLite model in
  // src/assets/models/ is loaded via require() (metro assetExts → bundled
  // into res/raw/), so linking it here would ship a redundant duplicate.
  assets: ['./src/assets/fonts/'],
};
