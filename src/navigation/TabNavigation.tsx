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

const Tab = createBottomTabNavigator();

interface TabNavigationProps {
  onLogout: () => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ onLogout }) => {
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
        tabBarButton: props => {
          // Show "New Features" overlay for Explore and Challenges tabs
          if (route.name === 'Explore' || route.name === 'Challenges') {
            return (
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
          }
          return <TouchableOpacity {...props} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen
        name="Explore"
        component={Explore}
        listeners={{
          tabPress: e => {
            e.preventDefault();
          },
        }}
      />
      <Tab.Screen
        name="Challenges"
        component={Challenges}
        listeners={{
          tabPress: e => {
            e.preventDefault();
          },
        }}
      />
      <Tab.Screen name="Saved" component={Saved} />
      <Tab.Screen name="Settings">
        {props => <SettingsScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default TabNavigation;
