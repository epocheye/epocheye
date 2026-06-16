import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Home from '../screens/Main/Home';
import Passport from '../screens/Main/Passport';
import Daily from '../screens/Main/Daily';
import SettingsScreen from '../screens/Main/SettingsScreen';
import {ROUTES} from '../core/constants';
import type {TabParamList} from '../core/types';
import FloatingTabBar from '../components/ui/FloatingTabBar';

const Tab = createBottomTabNavigator<TabParamList>();

interface TabNavigationProps {
  onLogout: () => void;
}

/**
 * Main shell — a custom floating gold-pill bottom tab bar (FloatingTabBar)
 * matching the premium designs. Four destinations (Home, Passport, Daily,
 * Account); each screen keeps its own header (headerShown:false). The tab bar
 * is absolutely positioned so screens render full-bleed beneath it (they add
 * their own bottom padding). Layered beneath the native-stack modals/pushes in
 * MainNavigation.
 */
const TabNavigation: React.FC<TabNavigationProps> = ({onLogout}) => {
  return (
    <Tab.Navigator
      initialRouteName={ROUTES.TABS.HOME}
      tabBar={props => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        tabBarHideOnKeyboard: true,
        sceneStyle: {backgroundColor: '#0A0A0C'},
      }}>
      <Tab.Screen name={ROUTES.TABS.HOME} component={Home} />
      <Tab.Screen name={ROUTES.TABS.PASSPORT} component={Passport} />
      <Tab.Screen name={ROUTES.TABS.DAILY} component={Daily} />
      <Tab.Screen name={ROUTES.TABS.ACCOUNT}>
        {props => <SettingsScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default TabNavigation;
