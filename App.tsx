import './global.css';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation';

export default function App() {
  return (
    <SafeAreaProvider style={{ backgroundColor: '#111111' }}>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
