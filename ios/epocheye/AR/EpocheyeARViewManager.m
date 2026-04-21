#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(EpocheyeARViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(identificationName, NSString)
RCT_EXPORT_VIEW_PROPERTY(identificationPeriod, NSString)
RCT_EXPORT_VIEW_PROPERTY(identificationSignificance, NSString)
RCT_EXPORT_VIEW_PROPERTY(identificationFact, NSString)
RCT_EXPORT_VIEW_PROPERTY(arEnabled, BOOL)

RCT_EXPORT_VIEW_PROPERTY(onARReady, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onCardTapped, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onARError, RCTDirectEventBlock)

@end
