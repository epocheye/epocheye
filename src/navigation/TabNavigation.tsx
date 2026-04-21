import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import Home from '../screens/Main/Home';
import Explore from '../screens/Main/Explore';
import Saved from '../screens/Main/Saved';
import SettingsScreen from '../screens/Main/SettingsScreen';
import PlanScreen from '../screens/Plan/PlanScreen';
import {
  HomeIcon,
  Bookmark,
  Map,
  Route,
  Settings,
} from 'lucide-react-native';
import { ROUTES } from '../core/constants';
import type { TabParamList } from '../core/types';

const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICON_SIZE = 22;

const TAB_COLORS = {
  barBackground: '#0A0A0A',
  barBorder: 'rgba(201, 168, 76, 0.28)',
  activeTint: '#C9A84C',
  inactiveTint: '#6B6357',
} as const;

const TAB_BAR_STYLE = {
  backgroundColor: TAB_COLORS.barBackground,
  borderTopColor: TAB_COLORS.barBorder,
  borderTopWidth: 1,
  paddingTop: 8,
  paddingBottom: 8,
  height: 68,
} as const;

const TAB_BAR_LABEL_STYLE = {
  fontFamily: 'MontserratAlternates-SemiBold',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  fontSize: 10,
  marginBottom: 2,
} as const;

interface TabNavigationProps {
  onLogout: () => void;
}

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
    case ROUTES.TABS.PLAN:
      return <Route color={color} size={iconSize} />;
    case ROUTES.TABS.SAVED:
      return <Bookmark color={color} size={iconSize} />;
    case ROUTES.TABS.SETTINGS:
    default:
      return <Settings color={color} size={iconSize} />;
  }
};

const DefaultTabButton: React.FC<BottomTabBarButtonProps> = props => (
  <PlatformPressable {...props} />
);

const TabNavigation: React.FC<TabNavigationProps> = ({ onLogout }) => {
  return (
    <Tab.Navigator
      initialRouteName={ROUTES.TABS.HOME}
      detachInactiveScreens
      screenOptions={({ route }) => ({
        headerShown: false,
        freezeOnBlur: true,
        lazy: true,
        tabBarShowLabel: true,
        tabBarActiveTintColor: TAB_COLORS.activeTint,
        tabBarInactiveTintColor: TAB_COLORS.inactiveTint,
        tabBarStyle: TAB_BAR_STYLE,
        tabBarLabelStyle: TAB_BAR_LABEL_STYLE,
        tabBarIcon: ({ color, size }) =>
          getTabIcon(route.name as keyof TabParamList, color, size),
        tabBarButton: (btnProps: BottomTabBarButtonProps) => (
          <DefaultTabButton {...btnProps} />
        ),
      })}
    >
      <Tab.Screen name={ROUTES.TABS.HOME} component={Home} />
      <Tab.Screen name={ROUTES.TABS.EXPLORE} component={Explore} />
      <Tab.Screen name={ROUTES.TABS.PLAN} component={PlanScreen} />
      <Tab.Screen name={ROUTES.TABS.SAVED} component={Saved} />
      <Tab.Screen name={ROUTES.TABS.SETTINGS}>
        {props => <SettingsScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default TabNavigation;
