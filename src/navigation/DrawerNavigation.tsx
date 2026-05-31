import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import Home from '../screens/Main/Home';
import Passport from '../screens/Main/Passport';
import Daily from '../screens/Main/Daily';
import SettingsScreen from '../screens/Main/SettingsScreen';
import { ROUTES } from '../core/constants';
import type { TabParamList } from '../core/types';
import CustomDrawerContent from './components/CustomDrawerContent';

const Drawer = createDrawerNavigator<TabParamList>();

interface DrawerNavigationProps {
  onLogout: () => void;
}

/**
 * Main shell — a hamburger-triggered side drawer (replaces the old bottom-tab
 * bar). Same four destinations; each screen keeps its own custom header
 * (headerShown:false) and exposes a hamburger that calls navigation.openDrawer().
 * Layered beneath the native-stack modals/pushes in MainNavigation.
 */
const DrawerNavigation: React.FC<DrawerNavigationProps> = ({ onLogout }) => {
  return (
    <Drawer.Navigator
      initialRouteName={ROUTES.TABS.HOME}
      drawerContent={props => (
        <CustomDrawerContent {...props} onLogout={onLogout} />
      )}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        drawerType: 'front',
        swipeEnabled: true,
        drawerStyle: {
          backgroundColor: '#0A0A0A',
          width: 300,
        },
      }}
    >
      <Drawer.Screen name={ROUTES.TABS.HOME} component={Home} />
      <Drawer.Screen name={ROUTES.TABS.PASSPORT} component={Passport} />
      <Drawer.Screen name={ROUTES.TABS.DAILY} component={Daily} />
      <Drawer.Screen name={ROUTES.TABS.ACCOUNT}>
        {props => <SettingsScreen {...props} onLogout={onLogout} />}
      </Drawer.Screen>
    </Drawer.Navigator>
  );
};

export default DrawerNavigation;
