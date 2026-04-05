/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

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
