import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, Image, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '../../context';
import { Award, Target, TrendingUp } from 'lucide-react-native';

const Profile = () => {
  const { profile, stats, isLoading, refreshUserData } = useUser();

  // Refresh user data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      refreshUserData();
    }, [refreshUserData]),
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#05050A] items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-[#9A9AAF] text-sm font-montserrat-regular mt-3">
          Loading profile...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#05050A]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="px-5 pt-10">
          {/* Profile Header */}
          <View className="items-center">
            <View className="w-24 h-24 rounded-full bg-white/5 items-center justify-center mb-4 border-2 border-white/10">
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  className="w-24 h-24 rounded-full"
                  resizeMode="cover"
                />
              ) : (
                <Image
                  source={require('../../assets/images/logo-white.png')}
                  className="w-16 h-16"
                  resizeMode="contain"
                />
              )}
            </View>
            <Text className="text-white text-3xl font-montserrat-bold text-center">
              {profile?.name || 'User'}
            </Text>
            <Text className="text-[#9A9AAF] text-base font-montserrat-medium mt-1">
              Historian & Explorer
            </Text>
            {profile?.email && (
              <Text className="text-[#6B6B78] text-sm font-montserrat-regular mt-1">
                {profile.email}
              </Text>
            )}
          </View>

          {/* Stats Cards */}
          {stats && (
            <View className="mt-8">
              <Text className="text-xs uppercase tracking-[4px] text-[#8B8B9E] font-montserrat-semibold mb-4">
                Your Stats
              </Text>

              <View className="flex-row mb-3">
                <View className="flex-1 rounded-3xl border border-white/10 bg-[#12121B] p-5 mr-3">
                  <View className="w-10 h-10 rounded-2xl bg-[#3B82F6]/10 items-center justify-center mb-3">
                    <Award size={20} color="#3B82F6" />
                  </View>
                  <Text className="text-white text-2xl font-montserrat-bold">
                    {stats.badges}
                  </Text>
                  <Text className="text-[#9A9AAF] text-sm font-montserrat-medium mt-1">
                    Badges Earned
                  </Text>
                </View>

                <View className="flex-1 rounded-3xl border border-white/10 bg-[#12121B] p-5">
                  <View className="w-10 h-10 rounded-2xl bg-[#FF7A18]/10 items-center justify-center mb-3">
                    <Target size={20} color="#FF7A18" />
                  </View>
                  <Text className="text-white text-2xl font-montserrat-bold">
                    {stats.challenges.total}
                  </Text>
                  <Text className="text-[#9A9AAF] text-sm font-montserrat-medium mt-1">
                    Total Challenges
                  </Text>
                </View>
              </View>

              <View className="rounded-3xl border border-white/10 bg-[#12121B] p-5">
                <View className="flex-row items-center mb-4">
                  <View className="w-10 h-10 rounded-2xl bg-[#10B981]/10 items-center justify-center mr-3">
                    <TrendingUp size={20} color="#10B981" />
                  </View>
                  <Text className="text-white text-lg font-montserrat-semibold">
                    Challenge Progress
                  </Text>
                </View>

                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-[#9A9AAF] text-sm font-montserrat-medium">
                    Pending
                  </Text>
                  <Text className="text-white text-lg font-montserrat-bold">
                    {stats.challenges.pending}
                  </Text>
                </View>

                {Object.entries(stats.challenges.progress_by_status).map(
                  ([status, count]) => (
                    <View
                      key={status}
                      className="flex-row items-center justify-between mb-3"
                    >
                      <Text className="text-[#9A9AAF] text-sm font-montserrat-medium capitalize">
                        {status.replace('_', ' ')}
                      </Text>
                      <Text className="text-white text-lg font-montserrat-bold">
                        {count}
                      </Text>
                    </View>
                  ),
                )}
              </View>
            </View>
          )}

          {/* Account Info */}
          <View className="mt-8">
            <Text className="text-xs uppercase tracking-[4px] text-[#8B8B9E] font-montserrat-semibold mb-4">
              Account Info
            </Text>

            <View className="rounded-3xl border border-white/10 bg-[#12121B] p-5">
              {profile?.created_at && (
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-[#9A9AAF] text-sm font-montserrat-medium">
                    Member Since
                  </Text>
                  <Text className="text-white text-sm font-montserrat-semibold">
                    {new Date(profile.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              )}

              {profile?.last_login && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-[#9A9AAF] text-sm font-montserrat-medium">
                    Last Login
                  </Text>
                  <Text className="text-white text-sm font-montserrat-semibold">
                    {new Date(profile.last_login).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;
