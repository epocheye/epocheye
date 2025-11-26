import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin,
  Calendar,
  Heart,
  ChevronRight,
  ChevronLeft,
  Check,
  Search,
  ChevronsRight,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_WIDTH = SCREEN_WIDTH - 48; // px-6 = 24px each side
const THUMB_SIZE = 56;
const SLIDE_THRESHOLD = SLIDER_WIDTH - THUMB_SIZE - 20;

interface QuestionnaireProps {
  onComplete: (preferences: UserPreferences) => void;
  onBack: () => void;
}

export interface UserPreferences {
  location: string;
  tourismFrequency: string;
  interests: string[];
}

// Indian cities for location dropdown
const INDIAN_CITIES = [
  'Delhi',
  'Mumbai',
  'Bengaluru',
  'Chennai',
  'Kolkata',
  'Hyderabad',
  'Pune',
  'Ahmedabad',
  'Jaipur',
  'Lucknow',
  'Agra',
  'Varanasi',
  'Udaipur',
  'Mysore',
  'Kochi',
  'Amritsar',
  'Jodhpur',
  'Bhopal',
  'Chandigarh',
  'Other',
];

const TOURISM_FREQUENCIES = [
  { id: 'frequently', label: 'Frequently', description: 'Every month or more' },
  { id: 'sometimes', label: 'Sometimes', description: 'A few times a year' },
  { id: 'rarely', label: 'Rarely', description: 'Once a year or less' },
];

const INTEREST_OPTIONS = [
  {
    id: 'heritage',
    label: 'Heritage Sites',
    description: 'Forts, palaces, monuments & UNESCO sites',
    icon: '🏛️',
    image:
      'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=400&q=80',
    examples: ['Red Fort', 'Taj Mahal', "Humayun's Tomb"],
  },
  {
    id: 'temples',
    label: 'Temples & Shrines',
    description: 'Ancient temples, sacred sites & spiritual places',
    icon: '🛕',
    image:
      'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=400&q=80',
    examples: ['Lotus Temple', 'Akshardham', 'Meenakshi Temple'],
  },
];

const Questionnaire: React.FC<QuestionnaireProps> = ({
  onComplete,
  onBack,
}) => {
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [tourismFrequency, setTourismFrequency] = useState('');
  const [interests, setInterests] = useState<string[]>([]);

  const totalSteps = 3;

  const filteredCities = useMemo(() => {
    if (!locationSearch) return INDIAN_CITIES;
    return INDIAN_CITIES.filter(city =>
      city.toLowerCase().includes(locationSearch.toLowerCase()),
    );
  }, [locationSearch]);

  const handleSelectLocation = useCallback((city: string) => {
    setLocation(city);
    setLocationSearch(city);
    setShowLocationDropdown(false);
  }, []);

  const toggleInterest = useCallback((id: string) => {
    setInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id],
    );
  }, []);

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return location.length > 0;
      case 2:
        return tourismFrequency.length > 0;
      case 3:
        return interests.length > 0;
      default:
        return false;
    }
  }, [step, location, tourismFrequency, interests]);

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(prev => prev + 1);
    } else {
      onComplete({
        location,
        tourismFrequency,
        interests,
      });
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(prev => prev - 1);
    } else {
      onBack();
    }
  };

  const getStepIcon = (stepNum: number) => {
    switch (stepNum) {
      case 1:
        return <MapPin color="#FF7A18" size={24} />;
      case 2:
        return <Calendar color="#FF7A18" size={24} />;
      case 3:
        return <Heart color="#FF7A18" size={24} />;
      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return 'Where do you live?';
      case 2:
        return 'How often do you travel?';
      case 3:
        return 'What interests you?';
      default:
        return '';
    }
  };

  const getStepSubtitle = () => {
    switch (step) {
      case 1:
        return "We'll find amazing heritage sites near you";
      case 2:
        return 'This helps us tailor recommendations';
      case 3:
        return 'Select all that apply';
      default:
        return '';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#070709]">
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-2">
          {/* Back Button */}
          <TouchableOpacity
            onPress={handleBack}
            className="w-11 h-11 rounded-full bg-[#12121A] border border-[#272730] items-center justify-center mb-6"
          >
            <ChevronLeft color="#FFFFFF" size={22} />
          </TouchableOpacity>

          {/* Progress Bar */}
          <View className="flex-row items-center mb-8">
            {[1, 2, 3].map(s => (
              <View key={s} className="flex-1 flex-row items-center">
                <View
                  className={`flex-1 h-1 rounded-full ${
                    s <= step ? 'bg-[#FF7A18]' : 'bg-[#272730]'
                  }`}
                />
                {s < 3 && <View className="w-2" />}
              </View>
            ))}
          </View>

          {/* Step Indicator */}
          <View className="flex-row items-center mb-2">
            <View className="w-12 h-12 rounded-2xl bg-[#FF7A18]/20 items-center justify-center mr-4">
              {getStepIcon(step)}
            </View>
            <View>
              <Text className="text-[#8D8D92] text-sm font-montserrat-medium">
                Step {step} of {totalSteps}
              </Text>
              <Text className="text-white text-2xl font-montserrat-bold mt-1">
                {getStepTitle()}
              </Text>
            </View>
          </View>
          <Text className="text-[#8D8D92] text-base font-montserrat-regular mt-2 mb-6">
            {getStepSubtitle()}
          </Text>
        </View>

        {/* Content */}
        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: Location */}
          {step === 1 && (
            <View>
              <View className="relative">
                <View className="flex-row items-center bg-[#12121A] rounded-2xl border border-[#272730] px-4">
                  <Search color="#8D8D92" size={20} />
                  <TextInput
                    value={locationSearch}
                    onChangeText={text => {
                      setLocationSearch(text);
                      setShowLocationDropdown(true);
                      if (!INDIAN_CITIES.includes(text)) {
                        setLocation('');
                      }
                    }}
                    onFocus={() => setShowLocationDropdown(true)}
                    placeholder="Search your city..."
                    placeholderTextColor="#8D8D92"
                    className="flex-1 py-4 px-3 text-white text-base font-montserrat-medium"
                  />
                  {location && (
                    <View className="w-6 h-6 rounded-full bg-[#10B981] items-center justify-center">
                      <Check color="#FFFFFF" size={14} />
                    </View>
                  )}
                </View>

                {/* Dropdown */}
                {showLocationDropdown && (
                  <View className="mt-2 bg-[#12121A] rounded-2xl border border-[#272730] max-h-64">
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {filteredCities.map(city => (
                        <TouchableOpacity
                          key={city}
                          onPress={() => handleSelectLocation(city)}
                          className={`px-4 py-3 border-b border-[#1F1F2A] ${
                            location === city ? 'bg-[#FF7A18]/10' : ''
                          }`}
                        >
                          <Text
                            className={`text-base font-montserrat-medium ${
                              location === city
                                ? 'text-[#FF7A18]'
                                : 'text-white'
                            }`}
                          >
                            {city}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Popular Cities */}
              <Text className="text-[#8D8D92] text-sm font-montserrat-medium mt-6 mb-3">
                Popular Cities
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {['Delhi', 'Mumbai', 'Jaipur', 'Agra', 'Varanasi'].map(city => (
                  <TouchableOpacity
                    key={city}
                    onPress={() => handleSelectLocation(city)}
                    className={`px-4 py-2 rounded-full border ${
                      location === city
                        ? 'bg-[#FF7A18] border-[#FF7A18]'
                        : 'bg-[#12121A] border-[#272730]'
                    }`}
                  >
                    <Text
                      className={`text-sm font-montserrat-medium ${
                        location === city ? 'text-white' : 'text-[#B4B4BA]'
                      }`}
                    >
                      {city}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step 2: Tourism Frequency */}
          {step === 2 && (
            <View className="gap-4">
              {TOURISM_FREQUENCIES.map(freq => (
                <TouchableOpacity
                  key={freq.id}
                  onPress={() => setTourismFrequency(freq.id)}
                  className={`p-5 rounded-2xl border ${
                    tourismFrequency === freq.id
                      ? 'bg-[#FF7A18]/10 border-[#FF7A18]'
                      : 'bg-[#12121A] border-[#272730]'
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text
                        className={`text-lg font-montserrat-semibold ${
                          tourismFrequency === freq.id
                            ? 'text-[#FF7A18]'
                            : 'text-white'
                        }`}
                      >
                        {freq.label}
                      </Text>
                      <Text className="text-[#8D8D92] text-sm font-montserrat-regular mt-1">
                        {freq.description}
                      </Text>
                    </View>
                    <View
                      className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                        tourismFrequency === freq.id
                          ? 'bg-[#FF7A18] border-[#FF7A18]'
                          : 'border-[#4A4A52]'
                      }`}
                    >
                      {tourismFrequency === freq.id && (
                        <Check color="#FFFFFF" size={14} />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Step 3: Interests */}
          {step === 3 && (
            <View className="gap-5">
              {INTEREST_OPTIONS.map(interest => {
                const isSelected = interests.includes(interest.id);
                return (
                  <TouchableOpacity
                    key={interest.id}
                    onPress={() => toggleInterest(interest.id)}
                    activeOpacity={0.85}
                    className={`rounded-3xl overflow-hidden border-2 ${
                      isSelected ? 'border-[#FF7A18]' : 'border-[#272730]'
                    }`}
                  >
                    {/* Card Image Header */}
                    <View className="relative h-36">
                      <Image
                        source={{ uri: interest.image }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                      {/* Gradient Overlay */}
                      <View className="absolute inset-0 bg-black/40" />

                      {/* Selection Indicator */}
                      <View
                        className={`absolute top-4 right-4 w-8 h-8 rounded-full items-center justify-center ${
                          isSelected
                            ? 'bg-[#FF7A18]'
                            : 'bg-black/40 border-2 border-white/50'
                        }`}
                      >
                        {isSelected && <Check color="#FFFFFF" size={18} />}
                      </View>

                      {/* Icon Badge */}
                      <View className="absolute bottom-4 left-4 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur items-center justify-center">
                        <Text className="text-3xl">{interest.icon}</Text>
                      </View>
                    </View>

                    {/* Card Content */}
                    <View
                      className={`p-5 ${
                        isSelected ? 'bg-[#FF7A18]/10' : 'bg-[#12121A]'
                      }`}
                    >
                      <Text
                        className={`text-xl font-montserrat-bold mb-2 ${
                          isSelected ? 'text-[#FF7A18]' : 'text-white'
                        }`}
                      >
                        {interest.label}
                      </Text>
                      <Text className="text-[#8D8D92] text-sm font-montserrat-regular mb-4">
                        {interest.description}
                      </Text>

                      {/* Example Tags */}
                      <View className="flex-row flex-wrap gap-2">
                        {interest.examples.map((example, idx) => (
                          <View
                            key={idx}
                            className={`px-3 py-1.5 rounded-full ${
                              isSelected ? 'bg-[#FF7A18]/20' : 'bg-[#1F1F2A]'
                            }`}
                          >
                            <Text
                              className={`text-xs font-montserrat-medium ${
                                isSelected ? 'text-[#FF7A18]' : 'text-[#B4B4BA]'
                              }`}
                            >
                              {example}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View className="h-32" />
        </ScrollView>

        {/* Bottom Action - Swipe Slider */}
        <SwipeSlider
          enabled={canProceed}
          onSwipeComplete={handleNext}
          label={
            step === totalSteps ? 'Swipe to Complete' : 'Swipe to Continue'
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Swipe Slider Component
interface SwipeSliderProps {
  enabled: boolean;
  onSwipeComplete: () => void;
  label: string;
}

const SwipeSlider: React.FC<SwipeSliderProps> = ({
  enabled,
  onSwipeComplete,
  label,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const [sliderWidth, setSliderWidth] = useState(SLIDER_WIDTH);
  const maxSlide = sliderWidth - THUMB_SIZE - 8;

  const resetSlider = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  }, [translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {},
        onPanResponderMove: (_, gestureState) => {
          if (!enabled) return;
          const newX = Math.max(0, Math.min(gestureState.dx, maxSlide));
          translateX.setValue(newX);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (!enabled) {
            resetSlider();
            return;
          }
          if (gestureState.dx >= maxSlide * 0.8) {
            Animated.timing(translateX, {
              toValue: maxSlide,
              duration: 100,
              useNativeDriver: false,
            }).start(() => {
              onSwipeComplete();
              setTimeout(resetSlider, 200);
            });
          } else {
            resetSlider();
          }
        },
        onPanResponderTerminate: () => {
          resetSlider();
        },
      }),
    [enabled, maxSlide, onSwipeComplete, resetSlider, translateX],
  );

  const progressWidth = translateX.interpolate({
    inputRange: [0, maxSlide],
    outputRange: [THUMB_SIZE + 8, sliderWidth],
    extrapolate: 'clamp',
  });

  const textOpacity = translateX.interpolate({
    inputRange: [0, maxSlide * 0.3],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const checkScale = translateX.interpolate({
    inputRange: [maxSlide * 0.6, maxSlide],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View className="px-6 pb-8 pt-4 bg-[#070709]">
      <View
        onLayout={e => setSliderWidth(e.nativeEvent.layout.width)}
        className={`h-16 rounded-2xl overflow-hidden relative ${
          enabled ? 'bg-[#1F1F2A]' : 'bg-[#1F1F2A]/50'
        }`}
      >
        {/* Progress Fill */}
        <Animated.View
          className="absolute left-0 top-0 bottom-0 bg-[#FF7A18]/25 rounded-2xl"
          style={{ width: progressWidth }}
        />

        {/* Centered Label */}
        <Animated.View
          className="absolute inset-0 items-center justify-center flex-row"
          style={{ opacity: textOpacity }}
        >
          <Text
            className={`text-base font-montserrat-semibold mr-2 ${
              enabled ? 'text-[#9A9AA0]' : 'text-[#4A4A52]'
            }`}
          >
            {label}
          </Text>
          <ChevronsRight color={enabled ? '#9A9AA0' : '#4A4A52'} size={20} />
        </Animated.View>

        {/* Draggable Thumb */}
        <Animated.View
          {...panResponder.panHandlers}
          className={`absolute left-1 top-1 w-16 h-14 rounded-xl items-center justify-center ${
            enabled ? 'bg-[#FF7A18]' : 'bg-[#3A3A42]'
          }`}
          style={{
            transform: [{ translateX }],
          }}
        >
          <ChevronsRight color="#FFFFFF" size={26} />
          {/* Check overlay */}
          <Animated.View
            className="absolute items-center justify-center"
            style={{ transform: [{ scale: checkScale }] }}
          >
            <Check color="#FFFFFF" size={26} />
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
};

export default Questionnaire;
