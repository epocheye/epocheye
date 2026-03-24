import { Text, View, TouchableOpacity, Dimensions } from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { Flashlight, Power } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

const Camera = () => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const camera = useRef<VisionCamera>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isTorchOn, setIsTorchOn] = useState(false);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const canUseTorch = Boolean(device?.hasTorch);

  const toggleTorch = () => {
    if (!canUseTorch) {
      return;
    }

    setIsTorchOn(prev => !prev);
  };

  const toggleCameraActive = () => {
    setIsCameraActive(prev => !prev);
  };

  if (!hasPermission) {
    return (
      <View
        className="items-center justify-center overflow-hidden rounded-[20px] bg-[#1a1a1a]"
        style={{ width: width - 40, height: height * 0.65 }}
      >
        <Text className="text-white text-center font-montserrat-medium">
          Camera permission is required
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-white px-6 py-3 rounded-full mt-4"
        >
          <Text className="text-black font-montserrat-semibold">
            Grant Permission
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View
        className="items-center justify-center overflow-hidden rounded-[20px] bg-[#1a1a1a]"
        style={{ width: width - 40, height: height * 0.65 }}
      >
        <Text className="text-white text-center font-montserrat-medium">
          No camera device found
        </Text>
      </View>
    );
  }

  return (
    <View
      className="items-center justify-center overflow-hidden rounded-[20px] bg-[#1a1a1a]"
      style={{ width: width - 40, height: height * 0.65 }}
    >
      {isCameraActive ? (
        <VisionCamera
          ref={camera}
          className="absolute inset-0"
          device={device}
          isActive={isCameraActive}
          photo={true}
          torch={isCameraActive && isTorchOn && canUseTorch ? 'on' : 'off'}
        />
      ) : (
        <View className="justify-center items-center">
          <Text className="text-white text-2xl font-montserrat-semibold text-center">
            Camera's taking a nap
          </Text>
          <Text className="text-white/60 text-base font-montserrat-medium text-center mt-2">
            Hit the power button to wake it up!
          </Text>
        </View>
      )}

      <View className="absolute bottom-[30px] w-full flex-row items-center justify-center">
        <TouchableOpacity
          onPress={toggleTorch}
          disabled={!canUseTorch || !isCameraActive}
          className={`mx-2 p-4 rounded-full ${
            isTorchOn ? 'bg-white' : 'bg-white/20'
          } ${!canUseTorch || !isCameraActive ? 'opacity-40' : ''}`}
          activeOpacity={0.7}
        >
          <Flashlight size={24} color={isTorchOn ? '#111111' : '#FFFFFF'} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleCameraActive}
          className={`mx-2 p-4 rounded-full ${
            isCameraActive ? 'bg-white/20' : 'bg-red-500'
          }`}
          activeOpacity={0.7}
        >
          <Power size={24} color={isCameraActive ? '#FFFFFF' : '#FFFFFF'} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Camera;
