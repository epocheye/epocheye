import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StatusBar,
  Animated,
  Image,
  Platform,
  ToastAndroid,
  Alert,
  FlatList,
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
  X,
  ChevronRight,
  Shield,
  ChevronUp,
  ChevronDown,
} from 'lucide-react-native';
import { useResolvedSubjectImage } from '../../shared/hooks';

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


const ARExperienceScreen: React.FC<ARExperienceScreenProps> = ({
  navigation,
  route,
}) => {
  const site = route.params?.site;
  const [scanState, setScanState] = useState<ScanState>('tutorial');
  const [scanProgress, setScanProgress] = useState(0);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const timelineHeightAnim = useRef(new Animated.Value(100)).current;
  const { url: resolvedArImage } = useResolvedSubjectImage({
    subject: site?.name || "Humayun's Tomb",
    context: `${site?.location || 'unknown location'} AR monument visual`,
    enabled: true,
    remote: true,
  });
  const cameraPlaceholderUri = resolvedArImage ?? CAMERA_PLACEHOLDER;

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

  // Scan line sweep animation for the AR experience view
  useEffect(() => {
    if (scanState === 'experience') {
      const sweep = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2800,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      sweep.start();
      return () => sweep.stop();
    }
  }, [scanState, scanLineAnim]);

  // Timeline height animation
  const handleTimelineToggle = useCallback(() => {
    const toValue = timelineExpanded ? 100 : 380;
    Animated.spring(timelineHeightAnim, {
      toValue,
      useNativeDriver: false,
      damping: 20,
      stiffness: 180,
    }).start();
    setTimelineExpanded(prev => !prev);
  }, [timelineExpanded, timelineHeightAnim]);

  // Show "coming soon" toast/alert for timeline node taps
  const handleTimelineNodePress = useCallback(() => {
    if (Platform.OS === 'android') {
      ToastAndroid.show('Coming soon', ToastAndroid.SHORT);
    } else {
      Alert.alert('Coming Soon', 'Timeline interaction is coming soon.');
    }
  }, []);

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


  const GENERIC_TIMELINE = [
    { id: '1', period: 'Ancient', years: '300 BCE – 600 CE', desc: 'Early settlements, trade routes, and the first stone temples.' },
    { id: '2', period: 'Early Medieval', years: '600 – 1200 CE', desc: 'Regional kingdoms, Sanskrit literature, and expanding devotional architecture.' },
    { id: '3', period: 'Sultanate', years: '1200 – 1526', desc: 'Delhi Sultanate rule, Indo-Islamic architecture and culture.' },
    { id: '4', period: 'Mughal Era', years: '1526 – 1857', desc: 'Mughal Empire at its height — gardens, mausoleums, and miniature painting.' },
    { id: '5', period: 'Colonial', years: '1857 – 1947', desc: 'British India, archaeology, and preservation movements begin.' },
  ];
  const timelineData = GENERIC_TIMELINE;

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
          source={{ uri: cameraPlaceholderUri }}
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

  // AR Experience Mode — three sections: Live View, Object ID Panel, Timeline Drawer
  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 600],
  });

  return (
    <View className="flex-1 bg-[#070709]">
      <StatusBar barStyle="light-content" />

      {/* ── Section 1: Live View ─────────────────────────────────────────── */}
      {/* TODO(video): Use a short looping monument flyover clip here for richer AR context. */}
      <Image
        source={{ uri: cameraPlaceholderUri }}
        className="absolute inset-0 w-full h-full"
        resizeMode="cover"
      />
      {/* Subtle amber AR tint */}
      <View className="absolute inset-0 bg-[#FF7A18]/10" />

      {/* Animated scan line sweep */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: 'rgba(212, 134, 10, 0.55)',
          transform: [{ translateY: scanLineTranslateY }],
          top: 0,
        }}
      />

      {/* Corner bracket markers */}
      {[
        { top: 90, left: 24 },
        { top: 90, right: 24 },
        { bottom: 440, left: 24 },
        { bottom: 440, right: 24 },
      ].map((pos, i) => (
        <View
          key={i}
          style={[
            {
              position: 'absolute',
              width: 22,
              height: 22,
              borderColor: 'rgba(212,134,10,0.7)',
              borderTopWidth: i < 2 ? 2 : 0,
              borderBottomWidth: i >= 2 ? 2 : 0,
              borderLeftWidth: i % 2 === 0 ? 2 : 0,
              borderRightWidth: i % 2 === 1 ? 2 : 0,
            },
            pos,
          ]}
        />
      ))}

      {/* "AR coming soon" label */}
      <SafeAreaView
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        pointerEvents="none"
      >
        <View className="items-center mt-16">
          <View className="flex-row items-center gap-1.5 bg-black/50 rounded-full px-3 py-1.5 border border-[rgba(212,134,10,0.3)]">
            <Sparkles color="#D4860A" size={11} />
            <Text className="text-[#D4860A] text-[11px] font-['MontserratAlternates-Medium']">
              Live AR launching soon
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Top controls */}
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
            <Text className="text-white text-sm font-['MontserratAlternates-SemiBold']">
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

      {/* Monument name info overlay */}
      <View className="absolute top-32 left-5 right-5">
        <View className="bg-black/60 rounded-2xl p-4">
          <Text className="text-white text-xl font-['MontserratAlternates-Bold']">
            {site?.name || "Humayun's Tomb"}
          </Text>
          <Text className="text-[#FF7A18] text-sm font-['MontserratAlternates-SemiBold'] mt-1">
            Heritage Monument
          </Text>
        </View>
      </View>

      {/* ── Section 3: Object Identification Panel ──────────────────────── */}
      <View
        style={{ position: 'absolute', left: 20, right: 20, bottom: 210 }}
      >
        <View className="bg-[#12121A]/90 rounded-2xl p-4 border border-[#272730] flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-[#D4860A]/15 items-center justify-center">
            <Camera color="#D4860A" size={20} />
          </View>
          <View className="flex-1">
            <Text className="text-[#F5F0E8] text-sm font-['MontserratAlternates-SemiBold']">
              Object Identification
            </Text>
            <Text className="text-[#8D8D92] text-xs font-['MontserratAlternates-Regular'] mt-0.5" numberOfLines={1}>
              Point your camera at an artifact to identify it
            </Text>
          </View>
          <View className="bg-[#D4860A]/15 border border-[#D4860A]/30 rounded-full px-2.5 py-1">
            <Text className="text-[#D4860A] text-[10px] font-['MontserratAlternates-SemiBold']">
              Soon
            </Text>
          </View>
        </View>
      </View>

      {/* ── Section 2: Timeline Drawer ───────────────────────────────────── */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: timelineHeightAnim,
          backgroundColor: 'rgba(12, 12, 18, 0.97)',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderTopWidth: 1,
          borderColor: '#272730',
          overflow: 'hidden',
        }}
      >
        {/* Drag handle + title */}
        <TouchableOpacity
          onPress={handleTimelineToggle}
          className="items-center pt-3 pb-2"
          accessibilityRole="button"
          accessibilityLabel={timelineExpanded ? 'Collapse timeline' : 'Expand timeline'}
        >
          <View className="w-9 h-1 rounded-full bg-[#3A3A44] mb-3" />
          <View className="flex-row items-center justify-between w-full px-5">
            <View className="flex-row items-center gap-2">
              <Clock color="#D4860A" size={16} />
              <Text className="text-[#F5F0E8] text-base font-['MontserratAlternates-SemiBold']">
                Historical Timeline
              </Text>
            </View>
            {timelineExpanded ? (
              <ChevronDown color="#6B6357" size={18} />
            ) : (
              <ChevronUp color="#6B6357" size={18} />
            )}
          </View>
        </TouchableOpacity>

        {/* Timeline nodes */}
        {timelineExpanded && (
          <FlatList
            data={timelineData}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                onPress={handleTimelineNodePress}
                className="flex-row items-start mb-4"
                accessibilityRole="button"
              >
                {/* Vertical connector */}
                <View className="items-center mr-3" style={{ width: 20 }}>
                  <View className="w-4 h-4 rounded-full bg-[#D4860A] items-center justify-center">
                    <View className="w-2 h-2 rounded-full bg-[#0A0A0A]" />
                  </View>
                  {index < timelineData.length - 1 && (
                    <View className="w-0.5 flex-1 bg-[#272730] mt-1" style={{ minHeight: 24 }} />
                  )}
                </View>
                <View className="flex-1 pb-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[#F5F0E8] text-sm font-['MontserratAlternates-SemiBold']">
                      {item.period}
                    </Text>
                    <Text className="text-[#6B6357] text-[11px] font-['MontserratAlternates-Regular']">
                      {item.years}
                    </Text>
                  </View>
                  <Text className="text-[#8D8D92] text-xs font-['MontserratAlternates-Regular'] mt-1 leading-4">
                    {item.desc}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        {/* Exit button */}
        {!timelineExpanded && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mx-5 mt-1 bg-[#1F1F2A] rounded-2xl py-3 items-center justify-center border border-[#272730]"
          >
            <Text className="text-white text-sm font-['MontserratAlternates-SemiBold']">
              Exit AR Experience
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Info Modal */}
      <Modal visible={showInfoModal} transparent animationType="fade">
        <View className="flex-1 bg-black/70 items-center justify-center px-8">
          <View className="bg-[#12121A] rounded-3xl p-6 w-full border border-[#272730]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-xl font-['MontserratAlternates-Bold']">
                AR Experience Help
              </Text>
              <TouchableOpacity onPress={() => setShowInfoModal(false)}>
                <X color="#8D8D92" size={24} />
              </TouchableOpacity>
            </View>
            <Text className="text-[#B4B4BA] text-base font-['MontserratAlternates-Regular'] leading-6">
              • Swipe up on the timeline drawer to explore historical periods
              {'\n'}• Tap the object panel to identify nearby artifacts (coming soon)
              {'\n'}• The scanning line shows where live AR will overlay
              {'\n'}• Live AR launching in a future update
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ARExperienceScreen;
