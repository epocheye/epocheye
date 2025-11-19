import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Home from '../screens/Main/Home';
import Saved from '../screens/Main/Saved';
import Explore from '../screens/Main/Explore';
import Profile from '../screens/Main/Profile';
import { HomeIcon, Bookmark, Map, UserRound } from 'lucide-react-native';

const Tab = createBottomTabNavigator();

const TabNavigation = () => {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#777777',
        tabBarStyle: {
          backgroundColor: '#111111',
          borderTopColor: '#111111',
          paddingVertical: 8,
          height: 65,
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
            case 'Saved':
              return <Bookmark color={color} size={iconSize} />;
            case 'Profile':
            default:
              return <UserRound color={color} size={iconSize} />;
          }
        },
      })}
    >
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Explore" component={Explore} />
      <Tab.Screen name="Saved" component={Saved} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
};

export default TabNavigation;
