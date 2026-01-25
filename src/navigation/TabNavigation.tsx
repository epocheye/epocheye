import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Home from '../screens/Main/Home';
import Explore from '../screens/Main/Explore';
import Challenges from '../screens/Main/Challenges.tsx';
import Saved from '../screens/Main/Saved';
import SettingsScreen from '../screens/Main/SettingsScreen';
import {
  HomeIcon,
  Bookmark,
  Map,
  Trophy,
  Settings,
  Sparkles,
} from 'lucide-react-native';
import { ROUTES } from '../core/constants';
import type { TabParamList } from '../core/types';

const Tab = createBottomTabNavigator<TabParamList>();

/** Tab icon size */
const TAB_ICON_SIZE = 22;

/** Tab bar style constants */
const TAB_BAR_STYLE = {
  backgroundColor: '#111',
  borderTopColor: '#151526',
  paddingVertical: 6,
  height: 60,
} as const;

/** Tab bar label style constants */
const TAB_BAR_LABEL_STYLE = {
  fontSize: 12,
  marginBottom: 4,
} as const;

interface TabNavigationProps {
  onLogout: () => void;
}

/**
 * Get the appropriate icon for a tab route
 */
const getTabIcon = (
  routeName: keyof TabParamList,
  color: string,
  size: number,
) => {
  const iconSize = size ?? TAB_ICON_SIZE;
  switch (routeName) {
    case ROUTES.TABS.HOME:
      return <HomeIcon color={color} size={iconSize} />;
    case ROUTES.TABS.EXPLORE:
      return <Map color={color} size={iconSize} />;
    case ROUTES.TABS.CHALLENGES:
      return <Trophy color={color} size={iconSize} />;
    case ROUTES.TABS.SAVED:
      return <Bookmark color={color} size={iconSize} />;
    case ROUTES.TABS.SETTINGS:
    default:
      return <Settings color={color} size={iconSize} />;
  }
};

/**
 * Renders a "Coming Soon" overlay for disabled tabs
 */
const ComingSoonTabButton: React.FC<{ props: any }> = ({ props }) => (
  <TouchableOpacity
    {...props}
    style={[props.style, { position: 'relative' }]}
    onPress={() => {}}
  >
    {props.children}
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
      }}
    >
      <Sparkles size={16} color="#FFD700" />
      <Text
        style={{
          color: '#FFD700',
          fontSize: 8,
          fontWeight: '600',
          marginTop: 2,
          textAlign: 'center',
        }}
      >
        New{'\n'}Features
      </Text>
    </View>
  </TouchableOpacity>
);

/**
 * Bottom tab navigation for authenticated users
 * Contains Home, Explore, Challenges, Saved, and Settings tabs
 */
const TabNavigation: React.FC<TabNavigationProps> = ({ onLogout }) => {
  return (
    <Tab.Navigator
      initialRouteName={ROUTES.TABS.HOME}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#777777',
        tabBarStyle: TAB_BAR_STYLE,
        tabBarLabelStyle: TAB_BAR_LABEL_STYLE,
        tabBarIcon: ({ color, size }) =>
          getTabIcon(route.name as keyof TabParamList, color, size),
        tabBarButton: (props: any) => {
          // Show "New Features" overlay for Explore and Challenges tabs
          if (
            route.name === ROUTES.TABS.EXPLORE ||
            route.name === ROUTES.TABS.CHALLENGES
          ) {
            return <ComingSoonTabButton props={props} />;
          }
          return <TouchableOpacity {...props} />;
        },
      })}
    >
      <Tab.Screen name={ROUTES.TABS.HOME} component={Home} />
      <Tab.Screen
        name={ROUTES.TABS.EXPLORE}
        component={Explore}
        listeners={{
          tabPress: e => {
            e.preventDefault();
          },
        }}
      />
      <Tab.Screen
        name={ROUTES.TABS.CHALLENGES}
        component={Challenges}
        listeners={{
          tabPress: e => {
            e.preventDefault();
          },
        }}
      />
      <Tab.Screen name={ROUTES.TABS.SAVED} component={Saved} />
      <Tab.Screen name={ROUTES.TABS.SETTINGS}>
        {props => <SettingsScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default TabNavigation;
