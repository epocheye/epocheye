import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// Keyboard-aware scroll so the edit-profile fields + Save stay visible while
// typing (RN edge-to-edge leaves plain ScrollViews underneath the IME).
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppAlert as Alert, showToast } from '../../shared/ui/appAlert';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import {
  Camera,
  ChevronRight,
  Headphones,
  Languages,
  LogOut,
  MapPin,
  MessageCircle,
  Save,
  Shield,
  Sparkles,
  Activity,
  Trash2,
  Volume2,
} from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { logout } from '../../utils/api/auth';
import { useUser } from '../../context';
import { useUserStore } from '../../stores/userStore';
import { PermissionService } from '../../shared/services/permission.service';
import { APP_CONFIG } from '../../core/config';
import AnimatedLogo from '../../components/ui/AnimatedLogo';
import { TourTarget } from '../../components/tour/useTourTarget';
import TourScrollView from '../../components/tour/TourScrollView';
import type { TabScreenProps } from '../../core/types/navigation.types';
import { ENABLE_ANCHOR_CAPTURE } from '@env';
import { ROUTES } from '../../core/constants';
import {
  useExplorerPass,
  usePassportSummary,
  useProfileDigest,
} from '../../shared/hooks';
import { useDevSettingsStore } from '../../stores/devSettingsStore';
import { useDataSharingStore } from '../../stores/dataSharingStore';
import {
  useMuseumPrefsStore,
  useNarrationLangResolution,
  narrationLangLabel,
  NARRATION_LANGS,
} from '../../stores/museumPrefsStore';
import { AUDIO_PERSONAS, type AudioPersona } from '../../utils/api/audio';
import { PERSONA_LABEL_KEY } from '../../shared/utils/audioGuide';
import {setAppLanguage} from '../../i18n';
import {useTourStore} from '../../stores/tourStore';
import DevLoadTestArModelButton from './components/DevLoadTestArModelButton';
import DevHealthCheckButton from './components/DevHealthCheckButton';
import { useIsAdmin } from '../../shared/hooks/useIsAdmin';
import { getVisitHistory, type VisitRow } from '../../utils/api/visits';
import { formatRelativeTime } from '../../shared/utils';
import { COLORS, FONTS, SKY_GRADIENT } from '../../core/constants/theme';
import StreakFlame from '../../components/ui/StreakFlame';
import LevelBadge from '../../components/ui/LevelBadge';
import { moderateScale } from '../../utils/scaling';

type RNFile = { uri: string; type: string; name: string };

type Props = TabScreenProps<'Account'> & { onLogout?: () => void };

// Capture Anchor is an internal admin tool. It is admin-gated AND hidden behind
// this build flag so it never appears in production — even for admin accounts —
// unless ENABLE_ANCHOR_CAPTURE is explicitly turned on for a dev build.
const ANCHOR_CAPTURE_ENABLED =
  ENABLE_ANCHOR_CAPTURE === 'true' || ENABLE_ANCHOR_CAPTURE === '1';

const SettingsScreen: React.FC<Props> = ({ navigation, onLogout }) => {
  const { t } = useTranslation();
  const { hasAnyActivePass, loading: explorerPassLoading } = useExplorerPass();
  const profile = useUser(state => state.profile);
  // App language is the source of truth; narration derives from it unless the
  // user sets an explicit override below.
  const {
    lang: narrationLang,
    appLang,
    isOverridden: narrationOverridden,
  } = useNarrationLangResolution();
  const setNarrationLangOverride = useMuseumPrefsStore(
    s => s.setNarrationLangOverride,
  );
  const narrationOverride = useMuseumPrefsStore(s => s.narrationLangOverride);
  const narrationPersona = useMuseumPrefsStore(s => s.narrationPersona);
  const setNarrationPersona = useMuseumPrefsStore(s => s.setNarrationPersona);
  const isLoading = useUser(state => state.isLoading);
  const updateProfile = useUser(state => state.updateProfile);
  const isAdmin = useIsAdmin();
  const uploadUserAvatar = useUser(state => state.uploadUserAvatar);
  const clearUserData = useUser(state => state.clearUserData);
  const refreshUserData = useUser(state => state.refreshUserData);
  const ensureUserDataLoaded = useUser(state => state.ensureUserDataLoaded);

  const { summary, refresh: refreshSummary } = usePassportSummary();
  const { digest, refresh: refreshDigest } = useProfileDigest();

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Visit history
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Permission status
  const [permissionStatus, setPermissionStatus] = useState({
    camera: false,
    location: false,
  });

  // Derived profile overview values
  const sites = summary?.sites_visited ?? 0;
  const dynasties = summary?.dynasties_count ?? 0;
  const streakDays = summary?.streak_days ?? 0;
  const recentJourneys = useMemo(() => visits.slice(0, 3), [visits]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.name || '');
      setEmail(profile.email || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      // Email is read-only (the profile update can't change it), so it must not
      // count toward "has changes" — otherwise Save would appear to succeed
      // while silently dropping the edited email.
      const changed =
        fullName !== profile.name || phone !== profile.phone;
      setHasChanges(changed);
    }
  }, [fullName, phone, profile]);

  const fetchVisits = useCallback(async () => {
    const result = await getVisitHistory();
    if (result.success) {
      setVisits(result.data.visits ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void ensureUserDataLoaded();
      void refreshUserData();
      void fetchVisits();
      PermissionService.checkAll().then(result => {
        setPermissionStatus({
          camera: result.camera,
          location: result.location,
        });
      });
    }, [ensureUserDataLoaded, refreshUserData, fetchVisits]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refreshSummary(),
      refreshDigest(),
      fetchVisits(),
      refreshUserData(),
    ]);
    setRefreshing(false);
  }, [refreshSummary, refreshDigest, fetchVisits, refreshUserData]);

  const goToSite = useCallback(
    (visit: VisitRow) => {
      navigation.navigate(ROUTES.MAIN.SITE_DETAIL, {
        site: { id: visit.place_id, name: visit.place_name },
      });
    },
    [navigation],
  );

  const handleSaveChanges = useCallback(async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      const success = await updateProfile({
        name: fullName,
        phone: phone,
        preferences: profile?.preferences ?? {},
      });
      if (success) {
        showToast(t('settings.profileUpdated'), { type: 'success' });
        setHasChanges(false);
      } else {
        // Surface the actual reason (set on the store by updateProfile) so the
        // failure is diagnosable instead of an opaque generic message.
        const reason = useUserStore.getState().error;
        Alert.alert(
          t('settings.error'),
          reason
            ? `${t('settings.updateProfileFailed')}\n\n${reason}`
            : t('settings.updateProfileFailed'),
        );
      }
    } catch {
      Alert.alert(t('settings.error'), t('settings.unexpectedError'));
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, updateProfile, fullName, phone, profile, t]);

  const handleAvatarUpload = useCallback(async () => {
    // Android 13+ uses the system photo picker, which grants access to the
    // chosen image without any runtime permission. Only request storage access
    // on iOS and Android ≤12 (where READ_EXTERNAL_STORAGE still applies).
    const needsStoragePermission =
      Platform.OS === 'ios' ||
      (Platform.OS === 'android' && Number(Platform.Version) < 33);
    if (needsStoragePermission) {
      const hasStoragePermission = await PermissionService.request('storage');
      if (!hasStoragePermission) {
        PermissionService.showSettingsAlert('storage');
        return;
      }
    }

    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 512,
        maxHeight: 512,
      },
      async response => {
        if (response.didCancel || response.errorCode) return;

        if (response.assets && response.assets[0]) {
          const asset = response.assets[0];
          const formData = new FormData();
          formData.append('avatar', {
            uri: asset.uri,
            type: asset.type || 'image/jpeg',
            name: asset.fileName || 'avatar.jpg',
          } as unknown as RNFile);

          try {
            const success = await uploadUserAvatar(formData);
            if (success) {
              showToast(t('settings.avatarUpdated'), { type: 'success' });
            } else {
              Alert.alert(t('settings.error'), t('settings.avatarUploadFailed'));
            }
          } catch {
            Alert.alert(t('settings.error'), t('settings.avatarUploadFailed'));
          }
        }
      },
    );
  }, [uploadUserAvatar, t]);

  const handleRequestPermission = useCallback(
    async (name: 'camera' | 'location') => {
      const granted = await PermissionService.request(name);
      if (granted) {
        setPermissionStatus(prev => ({ ...prev, [name]: true }));
      } else {
        PermissionService.showSettingsAlert(name);
      }
    },
    [],
  );

  const handleLogout = useCallback(() => {
    Alert.alert(t('settings.logoutTitle'), t('settings.logoutConfirm'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.logoutTitle'),
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            clearUserData();
            if (onLogout) onLogout();
          } catch {
            Alert.alert(t('settings.error'), t('settings.logoutFailed'));
          }
        },
      },
    ]);
  }, [clearUserData, onLogout, t]);

  // Selected individually so a change to one does not re-render on the other.
  const shareSiteData = useDataSharingStore(st => st.shareSiteData);
  const setShareSiteData = useDataSharingStore(st => st.setShareSiteData);

  const permissionRows = [
    {
      key: 'camera' as const,
      label: t('settings.camera'),
      granted: permissionStatus.camera,
    },
    {
      key: 'location' as const,
      label: t('settings.location'),
      granted: permissionStatus.location,
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-ink-deep">
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0A0A0C', '#100E15', '#0A0A0C']}
        locations={[0, 0.5, 1]}
        className="flex-1"
      >
        <TourScrollView
          as={KeyboardAwareScrollView}
          showsVerticalScrollIndicator={false}
          bottomOffset={24}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.sky}
              colors={[COLORS.sky]}
            />
          }
        >
          {/* ── Header ── */}
          <View className="px-6 pt-3">
            <Text style={{ fontFamily: FONTS.display, fontSize: moderateScale(28) }} className="text-foreground tracking-tight">
              {t('settings.account')}
            </Text>
          </View>

          {/* ── Explorer rank + stat cards ── */}
          <Animated.View
            entering={FadeInDown.delay(60).duration(350)}
            className="mt-4 px-6"
          >
            <View className="mb-3 flex-row items-center justify-between">
              <LevelBadge sites={sites} />
              <StreakFlame days={streakDays} size={20} label={t('settings.dayStreak')} />
            </View>
            <View className="flex-row gap-x-[10px]">
              {(
                [
                  { label: t('settings.statSites'), value: sites },
                  { label: t('settings.statDynasties'), value: dynasties },
                  { label: t('settings.statStreak'), value: streakDays },
                ] as const
              ).map(stat => (
                <View
                  key={stat.label}
                  className="flex-1 bg-white/[0.04] border border-[rgba(203,168,98,0.18)] items-center"
                  style={{
                    paddingVertical: moderateScale(14),
                    paddingHorizontal: moderateScale(10),
                    borderRadius: moderateScale(14),
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: 32,
                      color: '#FFFFFF',
                      lineHeight: 36,
                    }}
                  >
                    {stat.value}
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      fontFamily: FONTS.uiSemiBold,
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.55)',
                      letterSpacing: 1.1,
                    }}
                  >
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* ── Weekly digest ── */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(350)}
            className="px-6"
          >
            <Text
              style={{
                marginTop: 24,
                fontFamily: FONTS.uiSemiBold,
                fontSize: 11,
                color: 'rgba(255,255,255,0.55)',
                letterSpacing: 1.2,
              }}
            >
              {t('settings.thisWeek')}
            </Text>
            <LinearGradient
              colors={SKY_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                marginTop: 12,
                borderRadius: 14,
                paddingHorizontal: 18,
                paddingTop: 14,
                paddingBottom: 16,
              }}
            >
              <Text
                style={{
                  fontFamily: FONTS.uiSemiBold,
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.78)',
                  letterSpacing: 1.4,
                }}
              >
                {t('settings.yourDigest')}
              </Text>
              {digest ? (
                <>
                  {digest.headline ? (
                    <Text
                      style={{
                        marginTop: 6,
                        fontFamily: FONTS.ui,
                        fontSize: 15,
                        color: 'rgba(255,255,255,0.92)',
                      }}
                    >
                      {digest.headline}
                    </Text>
                  ) : null}
                  {digest.body ? (
                    <Text
                      style={{
                        marginTop: 4,
                        fontFamily: FONTS.display,
                        fontSize: 28,
                        color: '#FFFFFF',
                        lineHeight: 34,
                      }}
                    >
                      {digest.body}
                    </Text>
                  ) : null}
                  {(digest.dynasty_tags?.length ?? 0) > 0 ? (
                    <View className="mt-3 flex-row flex-wrap gap-[6px]">
                      {(digest.dynasty_tags ?? []).map(tag => (
                        <View
                          key={tag}
                          className="px-[10px] py-[5px] rounded-full bg-white/[0.18]"
                        >
                          <Text
                            style={{
                              fontFamily: FONTS.uiMedium,
                              fontSize: 11,
                              color: '#FFFFFF',
                            }}
                          >
                            {tag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <Text
                  style={{
                    marginTop: 6,
                    fontFamily: FONTS.ui,
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.85)',
                  }}
                >
                  {t('settings.digestEmpty')}
                </Text>
              )}
            </LinearGradient>
          </Animated.View>

          {/* ── Recent journeys ── */}
          <Animated.View
            entering={FadeInDown.delay(140).duration(350)}
            className="px-6 mt-[22px]"
          >
            <View className="mb-[10px] flex-row justify-between items-center">
              <Text
                style={{
                  fontFamily: FONTS.uiSemiBold,
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.55)',
                  letterSpacing: 1.2,
                }}
              >
                {t('settings.recentJourneys')}
              </Text>
              <Pressable
                onPress={() => navigation.navigate(ROUTES.MAIN.HISTORY)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('settings.viewAllJourneys')}
              >
                <Text
                  style={{
                    fontFamily: FONTS.uiMedium,
                    fontSize: 13,
                    color: COLORS.sky,
                  }}
                >
                  {t('settings.viewAll')}
                </Text>
              </Pressable>
            </View>
            {recentJourneys.length > 0 ? (
              recentJourneys.map(visit => (
                <Pressable
                  key={visit.id}
                  onPress={() => goToSite(visit)}
                  style={({ pressed }) =>
                    pressed ? { opacity: 0.85 } : undefined
                  }
                  className="flex-row items-center py-[10px] px-[10px] rounded-xl bg-white/[0.04] border border-white/[0.06] mb-2"
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.visitLabel', { name: visit.place_name })}
                >
                  <View className="w-11 h-11 rounded-lg bg-[rgba(203,168,98,0.22)] mr-3" />
                  <View className="flex-1">
                    <Text
                      style={{
                        fontFamily: FONTS.uiSemiBold,
                        fontSize: 14,
                        color: '#FFFFFF',
                      }}
                      numberOfLines={1}
                    >
                      {visit.place_name}
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontFamily: FONTS.ui,
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.55)',
                      }}
                      numberOfLines={1}
                    >
                      {formatRelativeTime(visit.arrived_at)}
                    </Text>
                  </View>
                  <ChevronRight color="rgba(255,255,255,0.45)" size={18} />
                </Pressable>
              ))
            ) : (
              <View className="py-6 items-center">
                <Text
                  style={{
                    fontFamily: FONTS.ui,
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.55)',
                    textAlign: 'center',
                  }}
                >
                  {t('settings.noJourneys')}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* ── Edit profile card ── */}
          {isLoading ? (
            <View
              className="mx-5 mt-6 mb-5 rounded-2xl border border-white/[0.08] bg-surface-1 p-5 items-center justify-center"
              style={{ height: 180 }}
            >
              <AnimatedLogo size={48} variant="white" motion="orbit" />
              <Text className="text-parchment-dim text-sm font-ui mt-3">
                {t('settings.loadingProfile')}
              </Text>
            </View>
          ) : (
            // Card margins live on the TourTarget so the spotlight measures the
            // card itself, not the full-width wrapper around it.
            <TourTarget
              id="account.profile"
              radius={16}
              style={{ marginHorizontal: 20, marginTop: 24, marginBottom: 20 }}
            >
            <Animated.View
              entering={FadeInDown.delay(180).duration(350)}
              className="rounded-2xl border border-white/[0.08] bg-surface-1 p-5"
            >
              <Text className="text-xs uppercase tracking-[1px] text-brand-gold font-ui-semibold mb-4">
                {t('settings.editProfile')}
              </Text>
              <View className="flex-row items-center mb-5">
                <View className="w-16 h-16 rounded-full bg-surface-2 items-center justify-center mr-4 relative">
                  {profile?.avatar_url ? (
                    <Image
                      source={{ uri: profile.avatar_url }}
                      className="w-16 h-16 rounded-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Image
                      source={require('../../assets/images/logo-white.png')}
                      className="w-10 h-10"
                      resizeMode="contain"
                    />
                  )}
                  <TouchableOpacity
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand-amber items-center justify-center"
                    onPress={handleAvatarUpload}
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.changeProfilePicture')}
                  >
                    <Camera size={14} color="#0A0A0A" />
                  </TouchableOpacity>
                </View>
                <View className="flex-1">
                  <Text className="text-parchment text-2xl font-display">
                    {fullName || t('settings.user')}
                  </Text>
                  <Text className="text-parchment-dim text-sm font-ui mt-0.5">
                    {email || t('settings.noEmail')}
                  </Text>
                </View>
              </View>

              <View className="mb-3">
                <Text className="text-xs uppercase tracking-[1px] text-parchment-dim font-ui-semibold mb-2">
                  {t('settings.fullName')}
                </Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder={t('settings.fullName')}
                  placeholderTextColor="rgba(245,240,232,0.25)"
                  className="bg-surface-2 border border-white/10 rounded-xl text-parchment font-ui-medium px-4 py-3 text-sm"
                  accessibilityLabel={t('settings.fullName')}
                />
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-xs uppercase tracking-[1px] text-parchment-dim font-ui-semibold mb-2">
                    {t('settings.email')}
                  </Text>
                  <TextInput
                    value={email}
                    editable={false}
                    keyboardType="email-address"
                    placeholder={t('settings.email')}
                    placeholderTextColor="rgba(245,240,232,0.25)"
                    className="bg-surface-2 border border-white/10 rounded-xl text-parchment-dim font-ui-medium px-4 py-3 text-sm opacity-70"
                    accessibilityLabel={t('settings.emailAddress')}
                  />
                  <Text className="text-[10px] text-parchment-dim font-ui mt-1">
                    {t('settings.emailReadonlyHint')}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xs uppercase tracking-[1px] text-parchment-dim font-ui-semibold mb-2">
                    {t('settings.phone')}
                  </Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder={t('settings.phone')}
                    placeholderTextColor="rgba(245,240,232,0.25)"
                    className="bg-surface-2 border border-white/10 rounded-xl text-parchment font-ui-medium px-4 py-3 text-sm"
                    accessibilityLabel={t('settings.phoneNumber')}
                  />
                </View>
              </View>

              {hasChanges && (
                <TouchableOpacity
                  className="mt-4 flex-row items-center justify-center rounded-xl bg-brand-gold py-3"
                  onPress={handleSaveChanges}
                  disabled={isSaving}
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.saveProfileChanges')}
                >
                  {isSaving ? (
                    <AnimatedLogo
                      size={18}
                      variant="white"
                      motion="pulse"
                      showRing={false}
                    />
                  ) : (
                    <>
                      <Save size={16} color="#0A0A0A" />
                      <Text className="text-ink text-sm font-ui-medium ml-2">
                        {t('settings.saveChanges')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </Animated.View>
            </TourTarget>
          )}

          {/* ── Passport CTA ── */}
          {!explorerPassLoading && !hasAnyActivePass && (
            <Animated.View entering={FadeInDown.delay(220).duration(350)}>
              <TouchableOpacity
                className="mx-5 mb-5 flex-row items-center rounded-2xl border border-[rgba(203,168,98,0.25)] bg-[rgba(26,24,34,0.85)] p-4"
                onPress={() => navigation.navigate(ROUTES.MAIN.PURCHASE)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('settings.getPassport')}
              >
                <View className="w-10 h-10 rounded-full bg-brand-sky/15 items-center justify-center mr-3">
                  <Sparkles size={18} color={COLORS.sky} />
                </View>
                <View className="flex-1">
                  <Text className="text-parchment text-base font-ui-semibold">
                    {t('settings.getPassport')}
                  </Text>
                  <Text className="text-parchment-dim text-xs font-ui mt-0.5">
                    {t('settings.unlockSites')}
                  </Text>
                </View>
                <ChevronRight size={18} color={COLORS.sky} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── Admin: Anchor capture (admin + build-flag gated) ── */}
          {isAdmin && ANCHOR_CAPTURE_ENABLED && (
            <Animated.View entering={FadeInDown.delay(260).duration(350)}>
              <TouchableOpacity
                className="mx-5 mb-5 flex-row items-center rounded-2xl border border-[rgba(72,187,120,0.3)] bg-[rgba(72,187,120,0.06)] p-4"
                onPress={() => navigation.navigate(ROUTES.MAIN.ANCHOR_CAPTURE)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('settings.captureAnchorA11y')}
              >
                <View className="w-10 h-10 rounded-full bg-[rgba(72,187,120,0.18)] items-center justify-center mr-3">
                  <MapPin size={18} color="#48BB78" />
                </View>
                <View className="flex-1">
                  <Text className="text-parchment text-base font-ui-semibold">
                    {t('settings.captureAnchor')}
                  </Text>
                  <Text className="text-parchment-dim text-xs font-ui mt-0.5">
                    {t('settings.captureAnchorSubtitle')}
                  </Text>
                </View>
                <ChevronRight size={18} color="#48BB78" />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── App language — the single source of truth ──
              Narration derives from this. The TourTarget stays on THIS block:
              it is an existing walkthrough step keyed to the language control. */}
          <TourTarget id="account.language">
          <Animated.View
            entering={FadeInDown.delay(280).duration(350)}
            className="mx-5 mb-5 rounded-2xl border border-white/[0.08] bg-surface-1 p-4"
          >
            <View className="flex-row items-center gap-2.5 mb-3">
              <View className="w-9 h-9 rounded-full bg-surface-2 items-center justify-center">
                <Languages size={16} color="#CBA862" />
              </View>
              <View className="flex-1">
                <Text className="text-parchment text-base font-ui-semibold">
                  {t('settings.appLanguage')}
                </Text>
                <Text className="text-parchment-dim text-xs font-ui mt-0.5">
                  {t('settings.appLanguageDesc')}
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2">
              {NARRATION_LANGS.map(({ code, label }) => {
                const active = appLang === code;
                return (
                  <Pressable
                    key={code}
                    onPress={() => {
                      // Sets i18n ONLY. Narration follows unless overridden
                      // below — there is no second language value to keep in
                      // step any more.
                      void setAppLanguage(code);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.setAppLanguage', { name: label })}
                    accessibilityState={{ selected: active }}
                    className={`flex-1 items-center py-2.5 rounded-xl border ${
                      active
                        ? 'bg-brand-amber border-brand-amber'
                        : 'bg-surface-2 border-white/[0.08]'
                    }`}
                  >
                    <Text
                      className={`text-sm font-ui-semibold ${
                        active ? 'text-[#0D0D0D]' : 'text-parchment'
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
          </TourTarget>

          {/* ── Narration language — follows the app unless overridden ── */}
          <Animated.View
            entering={FadeInDown.delay(285).duration(350)}
            className="mx-5 mb-5 rounded-2xl border border-white/[0.08] bg-surface-1 p-4"
          >
            <View className="flex-row items-center gap-2.5 mb-3">
              <View className="w-9 h-9 rounded-full bg-surface-2 items-center justify-center">
                <Volume2 size={16} color="#CBA862" />
              </View>
              <View className="flex-1">
                <Text className="text-parchment text-base font-ui-semibold">
                  {t('settings.narrationLanguage')}
                </Text>
                <Text className="text-parchment-dim text-xs font-ui mt-0.5">
                  {t('settings.narrationLanguageDesc')}
                </Text>
              </View>
            </View>

            {/* Clearing the override is a first-class choice, not a hidden gesture. */}
            <Pressable
              onPress={() => setNarrationLangOverride(null)}
              accessibilityRole="button"
              accessibilityLabel={t('settings.followAppLanguage')}
              accessibilityState={{ selected: narrationOverride == null }}
              className={`items-center py-2.5 rounded-xl border mb-2 ${
                narrationOverride == null
                  ? 'bg-brand-amber border-brand-amber'
                  : 'bg-surface-2 border-white/[0.08]'
              }`}
            >
              <Text
                className={`text-sm font-ui-semibold ${
                  narrationOverride == null ? 'text-[#0D0D0D]' : 'text-parchment'
                }`}
              >
                {t('settings.followAppLanguage')}
              </Text>
            </Pressable>

            <View className="flex-row gap-2">
              {NARRATION_LANGS.map(({ code, label }) => {
                const active = narrationOverride === code;
                return (
                  <Pressable
                    key={code}
                    onPress={() => setNarrationLangOverride(code)}
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.setNarrationLanguage', { name: label })}
                    accessibilityState={{ selected: active }}
                    className={`flex-1 items-center py-2.5 rounded-xl border ${
                      active
                        ? 'bg-brand-amber border-brand-amber'
                        : 'bg-surface-2 border-white/[0.08]'
                    }`}
                  >
                    <Text
                      className={`text-sm font-ui-semibold ${
                        active ? 'text-[#0D0D0D]' : 'text-parchment'
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* The divergence is stated in words, not implied by two highlighted
                chips in different cards — that is the whole point of the override
                being explicit. */}
            {narrationOverridden && (
              <Text className="text-parchment-dim text-xs font-ui mt-3">
                {t('settings.narrationOverrideNotice', {
                  narration: narrationLangLabel(narrationLang),
                  app: narrationLangLabel(appLang),
                })}
              </Text>
            )}
          </Animated.View>

          {/* ── Narration voice (persona) ── */}
          <Animated.View
            entering={FadeInDown.delay(290).duration(350)}
            className="mx-5 mb-5 rounded-2xl border border-white/[0.08] bg-surface-1 p-4"
          >
            <View className="flex-row items-center gap-2.5 mb-3">
              <View className="w-9 h-9 rounded-full bg-surface-2 items-center justify-center">
                <Headphones size={16} color="#CBA862" />
              </View>
              <View className="flex-1">
                <Text className="text-parchment text-base font-ui-semibold">
                  {t('settings.narrationVoice')}
                </Text>
                <Text className="text-parchment-dim text-xs font-ui mt-0.5">
                  {t('settings.narrationVoiceDesc')}
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2">
              {AUDIO_PERSONAS.map((code: AudioPersona) => {
                const active = narrationPersona === code;
                const label = t(PERSONA_LABEL_KEY[code]);
                return (
                  <Pressable
                    key={code}
                    onPress={() => setNarrationPersona(code)}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: active }}
                    className={`flex-1 items-center py-2.5 rounded-xl border ${
                      active
                        ? 'bg-brand-amber border-brand-amber'
                        : 'bg-surface-2 border-white/[0.08]'
                    }`}
                  >
                    <Text
                      numberOfLines={1}
                      className={`text-sm font-ui-semibold ${
                        active ? 'text-[#0D0D0D]' : 'text-parchment'
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* ── Permissions ── */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(350)}
            className="mx-5 mb-5 rounded-2xl border border-white/[0.08] bg-surface-1 p-4"
          >
            <View className="flex-row items-center gap-2.5 mb-4">
              <View className="w-9 h-9 rounded-full bg-surface-2 items-center justify-center">
                <Shield size={16} color="#CBA862" />
              </View>
              <Text className="text-parchment text-base font-ui-semibold">
                {t('settings.permissions')}
              </Text>
            </View>

            {permissionRows.map(item => (
              <View
                key={item.key}
                className="flex-row items-center justify-between py-3 border-b border-white/[0.05] last:border-b-0"
              >
                <View className="flex-row items-center gap-2.5">
                  {item.key === 'camera' ? (
                    <Camera size={16} color="#6B6357" />
                  ) : (
                    <MapPin size={16} color="#6B6357" />
                  )}
                  <Text className="text-parchment text-sm font-ui-medium">
                    {item.label}
                  </Text>
                </View>

                {item.granted ? (
                  <View className="bg-status-success/15 border border-status-success/30 rounded-full px-2.5 py-1">
                    <Text className="text-status-success text-[10px] font-ui-semibold">
                      {t('settings.granted')}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleRequestPermission(item.key)}
                    className="bg-brand-amber/15 border border-brand-amber/30 rounded-full px-2.5 py-1"
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.grantPermission', { name: item.label })}
                  >
                    <Text className="text-brand-amber text-[10px] font-ui-semibold">
                      {t('settings.grant')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity
              className="mt-3 flex-row items-center justify-center rounded-xl border border-white/[0.08] bg-surface-2 py-2.5"
              onPress={() => PermissionService.openAppSettings()}
              accessibilityRole="button"
              accessibilityLabel={t('settings.openDeviceSettingsA11y')}
            >
              <Shield size={14} color="#6B6357" />
              <Text className="text-parchment-muted text-xs font-ui-medium ml-1.5">
                {t('settings.openDeviceSettings')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="mt-3 flex-row items-center justify-center rounded-xl border border-white/[0.08] bg-surface-2 py-2.5"
              onPress={() => {
                // No mail client → openURL rejects. Show the address so the tap
                // isn't a silent no-op.
                Linking.openURL('mailto:support@epocheye.app').catch(() =>
                  Alert.alert(
                    t('settings.getSupport'),
                    t('settings.supportEmailFallback'),
                  ),
                );
              }}
              accessibilityRole="button"
              accessibilityLabel={t('settings.getSupport')}
            >
              <MessageCircle size={14} color="#B8AF9E" />
              <Text className="text-parchment-muted text-xs font-ui-medium ml-1.5">
                {t('settings.getSupport')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="mt-3 flex-row items-center justify-center rounded-xl border border-white/[0.08] bg-surface-2 py-2.5"
              onPress={() => useTourStore.getState().start()}
              accessibilityRole="button"
              accessibilityLabel={t('settings.replayTour')}
            >
              <Sparkles size={14} color="#B8AF9E" />
              <Text className="text-parchment-muted text-xs font-ui-medium ml-1.5">
                {t('settings.replayTour')}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Improving the reconstructions ──
              A card of its own rather than a line inside Permissions: this is a
              choice about what the visitor contributes, not a capability the OS
              grants, and burying it under "Permissions" would make it read as
              something the phone already decided. */}
          <Animated.View
            entering={FadeInDown.delay(340).duration(350)}
            className="mx-5 mb-5 rounded-2xl border border-white/[0.08] bg-surface-1 p-4"
          >
            <View className="flex-row items-center gap-2.5 mb-3">
              <View className="w-9 h-9 rounded-full bg-surface-2 items-center justify-center">
                <Activity size={16} color="#CBA862" />
              </View>
              <Text className="text-parchment text-base font-ui-semibold">
                {t('settings.dataSharingTitle')}
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <Text className="text-parchment-muted text-xs font-ui-regular flex-1 pr-3 leading-5">
                {t('settings.dataSharingBody')}
              </Text>
              <Switch
                value={shareSiteData}
                onValueChange={setShareSiteData}
                trackColor={{ false: '#3A3630', true: 'rgba(203,168,98,0.5)' }}
                thumbColor={shareSiteData ? '#CBA862' : '#6B6357'}
                accessibilityLabel={t('settings.dataSharingTitle')}
              />
            </View>
          </Animated.View>

          <DevLoadTestArModelButton />
          <DevHealthCheckButton />

          {/* ── App version ── */}
          <Animated.View
            entering={FadeInDown.delay(360).duration(350)}
            className="items-center py-6"
          >
            <TouchableOpacity
              onLongPress={() => {
                const next = !useDevSettingsStore.getState().devBypass;
                useDevSettingsStore.getState().setDevBypass(next);
                Alert.alert(
                  'Dev bypass',
                  next
                    ? 'Enabled. Identify Object will now do generic object detection + tap-to-select.'
                    : 'Disabled. Heritage identification flow restored.',
                );
              }}
              delayLongPress={1200}
              accessibilityRole="none"
              accessible={false}
            >
              <Text className="text-parchment-dim text-xs font-ui-medium">
                {t('settings.version', { version: APP_CONFIG.APP.VERSION })}
                {useDevSettingsStore(s => s.devBypass) ? ' · dev' : ''}
              </Text>
            </TouchableOpacity>
            <Text className="text-parchment-dim/60 text-[10px] font-ui mt-1">
              {t('settings.madeWithCare')}
            </Text>
          </Animated.View>

          {/* ── Account actions ── */}
          <Animated.View
            entering={FadeInDown.delay(420).duration(350)}
            className="flex-row px-5 gap-3 mb-12"
          >
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center rounded-xl bg-surface-1 border border-white/[0.08] py-3.5"
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel={t('settings.logOut')}
            >
              <LogOut size={16} color="#B8AF9E" />
              <Text className="text-parchment-muted text-sm font-ui-semibold ml-2">
                {t('settings.logOut')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center rounded-xl border border-status-danger/30 bg-status-danger/5 py-3.5"
              onPress={() =>
                Alert.alert(
                  t('settings.comingSoon'),
                  t('settings.deleteAccountComingSoon'),
                )
              }
              accessibilityRole="button"
              accessibilityLabel={t('settings.deleteAccount')}
            >
              <Trash2 size={16} color="#EF4444" />
              <Text className="text-status-danger text-sm font-ui-semibold ml-2">
                {t('settings.deleteAccount')}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </TourScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

export default SettingsScreen;
