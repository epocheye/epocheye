import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Home from '../screens/Main/Home';
import Explore from '../screens/Main/Explore';
import Challenges from '../screens/Main/Challenges.tsx';
import Saved from '../screens/Main/Saved';
import SettingsScreen from '../screens/Main/SettingsScreen';
import { HomeIcon, Bookmark, Map, Trophy, Settings } from 'lucide-react-native';

const Tab = createBottomTabNavigator();

const TabNavigation = () => {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#777777',
        tabBarStyle: {
          backgroundColor: '#111',
          borderTopColor: '#151526',
          paddingVertical: 6,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 4,
        },
        tabBarIcon: ({ color, size }) => {
          const iconSize = size ?? 22;
          switch (route.name) {
            case 'Home':
              return <HomeIcon color={color} size={iconSize} />;
            case 'Explore':
              return <Map color={color} size={iconSize} />;
            case 'Challenges':
              return <Trophy color={color} size={iconSize} />;
            case 'Saved':
              return <Bookmark color={color} size={iconSize} />;
            case 'Settings':
            default:
              return <Settings color={color} size={iconSize} />;
          }
        },
      })}
    >
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Explore" component={Explore} />
      <Tab.Screen name="Challenges" component={Challenges} />
      <Tab.Screen name="Saved" component={Saved} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

export default TabNavigation;
