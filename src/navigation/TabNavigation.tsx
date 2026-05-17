import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import Home from '../screens/Main/Home';
import Passport from '../screens/Main/Passport';
import Daily from '../screens/Main/Daily';
import Profile from '../screens/Main/Profile';
import { Map as MapIcon, Ticket, Clock, UserRound } from 'lucide-react-native';
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

const getTabIcon = (
  routeName: keyof TabParamList,
  color: string,
  size: number,
) => {
  const iconSize = size ?? TAB_ICON_SIZE;
  switch (routeName) {
    case ROUTES.TABS.HOME:
      return <MapIcon color={color} size={iconSize} />;
    case ROUTES.TABS.PASSPORT:
      return <Ticket color={color} size={iconSize} />;
    case ROUTES.TABS.DAILY:
      return <Clock color={color} size={iconSize} />;
    case ROUTES.TABS.PROFILE:
    default:
      return <UserRound color={color} size={iconSize} />;
  }
};

const DefaultTabButton: React.FC<BottomTabBarButtonProps> = props => (
  <PlatformPressable {...props} />
);

const TabNavigation: React.FC = () => {
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
      <Tab.Screen name={ROUTES.TABS.PASSPORT} component={Passport} />
      <Tab.Screen name={ROUTES.TABS.DAILY} component={Daily} />
      <Tab.Screen name={ROUTES.TABS.PROFILE} component={Profile} />
    </Tab.Navigator>
  );
};

export default TabNavigation;
