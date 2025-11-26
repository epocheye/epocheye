import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StatusBar,
  Dimensions,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Camera,
  Scan,
  Info,
  HelpCircle,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  BookOpen,
  Brain,
  X,
  ChevronRight,
  Shield,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Demo monument placeholder
const CAMERA_PLACEHOLDER =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80';

interface ARExperienceScreenProps {
  navigation: any;
  route: any;
}

type ScanState =
  | 'tutorial'
  | 'permission'
  | 'ready'
  | 'scanning'
  | 'detected'
  | 'retry'
  | 'experience';

interface FeatureContent {
  title: string;
  content: string;
  image?: string;
}

const ARExperienceScreen: React.FC<ARExperienceScreenProps> = ({
  navigation,
  route,
}) => {
  const site = route.params?.site;
  const [scanState, setScanState] = useState<ScanState>('tutorial');
  const [scanProgress, setScanProgress] = useState(0);
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const scanProgressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for scan frame
  useEffect(() => {
    if (scanState === 'ready' || scanState === 'scanning') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [scanState, pulseAnim]);

  // Simulated scan progress
  const startScanning = useCallback(() => {
    setScanState('scanning');
    setScanProgress(0);
    scanProgressAnim.setValue(0);

    Animated.timing(scanProgressAnim, {
      toValue: 100,
      duration: 3000,
      useNativeDriver: false,
    }).start();

    // Update progress state for display
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          // Randomly decide success or retry (80% success)
          setTimeout(() => {
            if (Math.random() > 0.2) {
              setScanState('detected');
              setTimeout(() => setScanState('experience'), 1500);
            } else {
              setScanState('retry');
            }
          }, 500);
          return 100;
        }
        return prev + 3;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [scanProgressAnim]);

  const handlePermissionGrant = useCallback(() => {
    setScanState('ready');
  }, []);

  const handleBeginScan = useCallback(() => {
    startScanning();
  }, [startScanning]);

  const handleRetry = useCallback(() => {
    setScanState('ready');
    setScanProgress(0);
  }, []);

  const handleFeaturePress = useCallback((feature: string) => {
    setActiveFeature(feature);
    setShowFeatureModal(true);
  }, []);

  const getFeatureContent = (feature: string): FeatureContent => {
    switch (feature) {
      case 'timeTravel':
        return {
          title: 'Time Travel',
          content: `Experience ${
            site?.name || "Humayun's Tomb"
          } as it looked in 1570 CE, right after its construction. The pristine white marble and red sandstone gleamed under the Mughal sun. Emperor Akbar himself visited here to pay respects to his father.\n\nThe gardens were meticulously maintained with Persian-style water channels (Char Bagh), featuring blooming roses, jasmine, and fruit trees that provided shade to visitors and royal guests.`,
          image: CAMERA_PLACEHOLDER,
        };
      case 'facts':
        return {
          title: 'Historical Facts',
          content: `• Built in 1570 CE by Empress Bega Begum\n• First garden-tomb on the Indian subcontinent\n• Inspired the design of the Taj Mahal\n• Contains 150+ Mughal family tombs\n• Height: 47 meters (154 feet)\n• Garden spans 27.04 hectares\n• UNESCO World Heritage Site since 1993\n• Construction took 8 years to complete\n• Architects: Mirak Mirza Ghiyas and son`,
        };
      case 'trivia':
        return {
          title: 'Did You Know?',
          content: `🎯 The last Mughal Emperor, Bahadur Shah Zafar II, took refuge here during the 1857 rebellion before being captured by the British.\n\n🏛️ The tomb's double dome technique was revolutionary - the outer dome is for external beauty while the inner dome maintains the interior proportions.\n\n🌸 The garden contains over 2,500 native plant species that have been carefully restored.`,
        };
      default:
        return { title: '', content: '' };
    }
  };

  // Tutorial Screen
  if (scanState === 'tutorial') {
    return (
      <SafeAreaView className="flex-1 bg-[#070709]">
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-11 h-11 rounded-full bg-[#12121A] border border-[#272730] items-center justify-center"
          >
            <ArrowLeft color="#FFFFFF" size={22} />
          </TouchableOpacity>
          <Text className="text-white text-lg font-montserrat-semibold">
            AR Tutorial
          </Text>
          <View className="w-11" />
        </View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
        >
          {/* Illustration */}
          <View className="items-center my-8">
            <View className="w-48 h-48 rounded-full bg-[#FF7A18]/10 items-center justify-center">
              <View className="w-36 h-36 rounded-full bg-[#FF7A18]/20 items-center justify-center">
                <Camera color="#FF7A18" size={64} />
              </View>
            </View>
          </View>

          <Text className="text-white text-2xl font-montserrat-bold text-center mb-4">
            How to Use AR Experience
          </Text>
          <Text className="text-[#8D8D92] text-base font-montserrat-regular text-center mb-8">
            Follow these simple steps to unlock the magic of history
          </Text>

          {/* Steps */}
          {[
            {
              icon: Scan,
              title: 'Point & Scan',
              description:
                'Hold your phone steady and point it at the monument facade.',
            },
            {
              icon: Clock,
              title: 'Wait for Detection',
              description:
                'Keep the monument within the frame while our AI identifies it.',
            },
            {
              icon: Sparkles,
              title: 'Explore History',
              description:
                'Once detected, interact with 3D overlays and historical info.',
            },
          ].map((step, index) => (
            <View
              key={index}
              className="flex-row items-start bg-[#12121A] rounded-2xl p-4 mb-4 border border-[#272730]"
            >
              <View className="w-12 h-12 rounded-full bg-[#FF7A18]/20 items-center justify-center">
                <step.icon color="#FF7A18" size={24} />
              </View>
              <View className="flex-1 ml-4">
                <Text className="text-white text-base font-montserrat-semibold mb-1">
                  {step.title}
                </Text>
                <Text className="text-[#8D8D92] text-sm font-montserrat-regular leading-5">
                  {step.description}
                </Text>
              </View>
            </View>
          ))}

          {/* Tips */}
          <View className="bg-[#3B82F6]/10 rounded-2xl p-4 mt-4 mb-8 border border-[#3B82F6]/30">
            <View className="flex-row items-center mb-2">
              <Info color="#3B82F6" size={20} />
              <Text className="text-[#3B82F6] text-base font-montserrat-semibold ml-2">
                Pro Tips
              </Text>
            </View>
            <Text className="text-[#8D8D92] text-sm font-montserrat-regular leading-5">
              • Works best in good lighting conditions{'\n'}• Stand 2-5 meters
              from the monument{'\n'}• Keep your phone stable during scanning
            </Text>
          </View>
        </ScrollView>

        {/* Continue Button */}
        <View className="px-5 pb-5">
          <TouchableOpacity
            onPress={() => setScanState('permission')}
            className="bg-[#FF7A18] rounded-2xl py-4 flex-row items-center justify-center"
          >
            <Text className="text-white text-lg font-montserrat-semibold">
              Continue
            </Text>
            <ChevronRight color="#FFFFFF" size={22} className="ml-2" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Permission Prompt
  if (scanState === 'permission') {
    return (
      <SafeAreaView className="flex-1 bg-[#070709]">
        <StatusBar barStyle="light-content" />

        <View className="flex-1 items-center justify-center px-8">
          <View className="w-32 h-32 rounded-full bg-[#12121A] border-2 border-[#272730] items-center justify-center mb-8">
            <Shield color="#FF7A18" size={56} />
          </View>

          <Text className="text-white text-2xl font-montserrat-bold text-center mb-4">
            Camera Permission
          </Text>
          <Text className="text-[#8D8D92] text-base font-montserrat-regular text-center mb-8 leading-6">
            We need access to your camera to scan monuments and provide the AR
            experience. Your privacy is protected.
          </Text>

          <TouchableOpacity
            onPress={handlePermissionGrant}
            className="w-full bg-[#FF7A18] rounded-2xl py-4 items-center justify-center mb-4"
          >
            <Text className="text-white text-lg font-montserrat-semibold">
              Allow Camera Access
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-full bg-[#1F1F2A] rounded-2xl py-4 items-center justify-center border border-[#272730]"
          >
            <Text className="text-[#8D8D92] text-lg font-montserrat-semibold">
              Maybe Later
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Ready to Scan / Scanning / Detected / Retry states
  if (['ready', 'scanning', 'detected', 'retry'].includes(scanState)) {
    return (
      <View className="flex-1 bg-[#070709]">
        <StatusBar barStyle="light-content" />

        {/* Camera Placeholder */}
        <Image
          source={{ uri: CAMERA_PLACEHOLDER }}
          className="absolute inset-0 w-full h-full"
          resizeMode="cover"
        />

        {/* Dark Overlay */}
        <View className="absolute inset-0 bg-black/40" />

        {/* Top Controls */}
        <SafeAreaView className="absolute top-0 left-0 right-0">
          <View className="flex-row items-center justify-between px-5 py-4">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-11 h-11 rounded-full bg-black/50 items-center justify-center"
            >
              <ArrowLeft color="#FFFFFF" size={22} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowInfoModal(true)}
              className="w-11 h-11 rounded-full bg-black/50 items-center justify-center"
            >
              <HelpCircle color="#FFFFFF" size={22} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Scan Frame */}
        <View className="flex-1 items-center justify-center">
          <Animated.View
            style={{ transform: [{ scale: pulseAnim }] }}
            className="w-72 h-72 border-4 border-white/50 rounded-3xl items-center justify-center"
          >
            {scanState === 'scanning' && (
              <View className="absolute inset-0 items-center justify-center">
                <Scan color="#FF7A18" size={80} />
              </View>
            )}

            {scanState === 'detected' && (
              <View className="absolute inset-0 items-center justify-center bg-[#10B981]/20 rounded-3xl">
                <CheckCircle color="#10B981" size={80} />
                <Text className="text-[#10B981] text-lg font-montserrat-bold mt-4">
                  Monument Detected!
                </Text>
              </View>
            )}

            {scanState === 'retry' && (
              <View className="absolute inset-0 items-center justify-center bg-[#EF4444]/20 rounded-3xl">
                <XCircle color="#EF4444" size={80} />
                <Text className="text-[#EF4444] text-lg font-montserrat-bold mt-4 text-center px-4">
                  Try scanning again
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Scan Progress Bar */}
          {scanState === 'scanning' && (
            <View className="absolute bottom-48 left-12 right-12">
              <View className="h-2 bg-white/20 rounded-full overflow-hidden">
                <Animated.View
                  className="h-full bg-[#FF7A18] rounded-full"
                  style={{
                    width: scanProgressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  }}
                />
              </View>
              <Text className="text-white text-center mt-3 font-montserrat-medium">
                Scanning... {Math.min(100, scanProgress)}%
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Controls */}
        <SafeAreaView
          className="absolute bottom-0 left-0 right-0"
          edges={['bottom']}
        >
          <View className="px-5 pb-5">
            {scanState === 'ready' && (
              <TouchableOpacity
                onPress={handleBeginScan}
                className="bg-[#FF7A18] rounded-2xl py-4 items-center justify-center"
              >
                <Text className="text-white text-lg font-montserrat-semibold">
                  Begin Scan
                </Text>
              </TouchableOpacity>
            )}

            {scanState === 'retry' && (
              <View className="flex-row gap-4">
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  className="flex-1 bg-[#1F1F2A] rounded-2xl py-4 items-center justify-center border border-[#272730]"
                >
                  <Text className="text-white text-base font-montserrat-semibold">
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRetry}
                  className="flex-1 bg-[#FF7A18] rounded-2xl py-4 items-center justify-center"
                >
                  <Text className="text-white text-base font-montserrat-semibold">
                    Try Again
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>

        {/* Info Modal */}
        <Modal visible={showInfoModal} transparent animationType="fade">
          <View className="flex-1 bg-black/70 items-center justify-center px-8">
            <View className="bg-[#12121A] rounded-3xl p-6 w-full border border-[#272730]">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-xl font-montserrat-bold">
                  Scanning Help
                </Text>
                <TouchableOpacity onPress={() => setShowInfoModal(false)}>
                  <X color="#8D8D92" size={24} />
                </TouchableOpacity>
              </View>
              <Text className="text-[#B4B4BA] text-base font-montserrat-regular leading-6">
                • Position the monument within the frame{'\n'}• Hold your device
                steady{'\n'}• Ensure good lighting{'\n'}• Stand 2-5 meters away
                {'\n'}• Avoid obstructions in front
              </Text>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // AR Experience Mode
  return (
    <View className="flex-1 bg-[#070709]">
      <StatusBar barStyle="light-content" />

      {/* Camera Placeholder with AR Overlay Effect */}
      <Image
        source={{ uri: CAMERA_PLACEHOLDER }}
        className="absolute inset-0 w-full h-full"
        resizeMode="cover"
      />

      {/* Subtle AR Overlay Effect */}
      <View className="absolute inset-0 bg-[#FF7A18]/10" />

      {/* Top Controls */}
      <SafeAreaView className="absolute top-0 left-0 right-0">
        <View className="flex-row items-center justify-between px-5 py-4">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-11 h-11 rounded-full bg-black/50 items-center justify-center"
          >
            <ArrowLeft color="#FFFFFF" size={22} />
          </TouchableOpacity>

          <View className="bg-[#10B981]/90 rounded-full px-4 py-2 flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-white mr-2" />
            <Text className="text-white text-sm font-montserrat-semibold">
              AR Active
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setShowInfoModal(true)}
            className="w-11 h-11 rounded-full bg-black/50 items-center justify-center"
          >
            <HelpCircle color="#FFFFFF" size={22} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* AR Info Overlay */}
      <View className="absolute top-32 left-5 right-5">
        <View className="bg-black/60 rounded-2xl p-4">
          <Text className="text-white text-xl font-montserrat-bold">
            {site?.name || "Humayun's Tomb"}
          </Text>
          <Text className="text-[#FF7A18] text-sm font-montserrat-semibold mt-1">
            Built: 1570 CE • Mughal Era
          </Text>
        </View>
      </View>

      {/* Feature Buttons at Bottom */}
      <SafeAreaView
        className="absolute bottom-0 left-0 right-0"
        edges={['bottom']}
      >
        <View className="px-5 pb-5">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
          >
            {[
              {
                id: 'timeTravel',
                label: 'Time Travel',
                icon: Clock,
                color: '#8B5CF6',
              },
              { id: 'facts', label: 'Facts', icon: BookOpen, color: '#3B82F6' },
              { id: 'trivia', label: 'Trivia', icon: Brain, color: '#10B981' },
            ].map(feature => (
              <TouchableOpacity
                key={feature.id}
                onPress={() => handleFeaturePress(feature.id)}
                className="mr-4 items-center"
              >
                <View
                  className="w-16 h-16 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: `${feature.color}20` }}
                >
                  <feature.icon color={feature.color} size={28} />
                </View>
                <Text className="text-white text-xs font-montserrat-medium">
                  {feature.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="bg-[#1F1F2A] rounded-2xl py-4 items-center justify-center border border-[#272730]"
          >
            <Text className="text-white text-base font-montserrat-semibold">
              Exit AR Experience
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Feature Content Modal */}
      <Modal visible={showFeatureModal} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-[#12121A] rounded-t-3xl max-h-[70%] border-t border-[#272730]">
            <View className="flex-row items-center justify-between p-5 border-b border-[#272730]">
              <Text className="text-white text-xl font-montserrat-bold">
                {activeFeature ? getFeatureContent(activeFeature).title : ''}
              </Text>
              <TouchableOpacity onPress={() => setShowFeatureModal(false)}>
                <X color="#8D8D92" size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
              {activeFeature && getFeatureContent(activeFeature).image && (
                <Image
                  source={{ uri: getFeatureContent(activeFeature).image }}
                  className="w-full h-48 rounded-2xl mb-4"
                  resizeMode="cover"
                />
              )}
              <Text className="text-[#B4B4BA] text-base font-montserrat-regular leading-7 pb-8">
                {activeFeature ? getFeatureContent(activeFeature).content : ''}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Info Modal */}
      <Modal visible={showInfoModal} transparent animationType="fade">
        <View className="flex-1 bg-black/70 items-center justify-center px-8">
          <View className="bg-[#12121A] rounded-3xl p-6 w-full border border-[#272730]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-xl font-montserrat-bold">
                AR Experience Help
              </Text>
              <TouchableOpacity onPress={() => setShowInfoModal(false)}>
                <X color="#8D8D92" size={24} />
              </TouchableOpacity>
            </View>
            <Text className="text-[#B4B4BA] text-base font-montserrat-regular leading-6">
              • Tap feature buttons to explore{'\n'}• Time Travel: See
              historical views{'\n'}• Facts: Learn key information{'\n'}•
              Trivia: Fun historical facts{'\n'}• Move your phone to explore
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ARExperienceScreen;
