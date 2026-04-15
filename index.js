/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { firebase } from '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Background/quit-state FCM handler. Must be registered at module scope before
// AppRegistry.registerComponent so the native bridge can reach it when the JS
// runtime is cold-started by a data push. Guarded: if no google-services.json
// is present, Firebase has no default app and messaging() would throw — skip
// registration so the app can still boot.
if (firebase.apps.length > 0) {
	try {
		messaging().setBackgroundMessageHandler(async () => {
			// Silent — the OS renders the push from the notification payload.
		});
	} catch (err) {
		if (__DEV__) console.warn('[fcm] background handler registration failed', err);
	}
} else if (__DEV__) {
	console.warn('[fcm] no default Firebase app; background handler skipped');
}

const ensurePerformanceApiShape = () => {
	const perf = global?.performance;

	if (!perf) {
		return;
	}

	if (typeof perf.clearMarks !== 'function') {
		try {
			perf.clearMarks = () => {};
		} catch (_error) {}
	}

	if (typeof perf.clearMeasures !== 'function') {
		try {
			perf.clearMeasures = () => {};
		} catch (_error) {}
	}
};

ensurePerformanceApiShape();

AppRegistry.registerComponent(appName, () => App);
