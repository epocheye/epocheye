/**
 * App-level error boundary.
 *
 * React Native has no default UI for an uncaught render/lifecycle error — in a
 * release build the error unwinds to the default handler and the app simply
 * closes with no message. Wrapping a screen in this boundary converts that
 * silent close into a calm, recoverable fallback and surfaces the actual error
 * so it can be diagnosed (full message + stack in __DEV__; behind a toggle in
 * production). It also logs to `console.error`, so the error shows in
 * `adb logcat` even on release builds.
 *
 * Note: this catches JS errors only. A native crash (e.g. a misbehaving native
 * module) will not be caught here and still needs a logcat trace.
 */

import React from 'react';
import {ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {AlertTriangle, RotateCcw} from 'lucide-react-native';

interface Props {
  children: React.ReactNode;
  /** Invoked by the "Go back" button (e.g. navigation.goBack). */
  onReset?: () => void;
  /** Label for the recovery button. */
  resetLabel?: string;
}

interface State {
  error: Error | null;
  showDetails: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = {error: null, showDetails: __DEV__};

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {error};
  }

  componentDidCatch(error: Error, info: {componentStack: string}) {
    // Surfaces in adb logcat (FATAL-adjacent) even in release builds.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({error: null, showDetails: __DEV__});
    this.props.onReset?.();
  };

  render() {
    const {error, showDetails} = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <View className="flex-1 bg-warm-deep items-center justify-center px-7">
        <View className="w-16 h-16 rounded-full bg-[rgba(184,85,26,0.15)] items-center justify-center mb-5">
          <AlertTriangle color="#B8551A" size={30} />
        </View>
        <Text className="text-parchment text-[24px] text-center font-['InstrumentSerif-Regular']">
          Something went wrong
        </Text>
        <Text className="text-parchment-muted text-sm text-center mt-2 leading-5 font-['InstrumentSans-Regular']">
          This screen hit an unexpected error. You can head back and try again.
        </Text>

        <TouchableOpacity
          onPress={this.handleReset}
          activeOpacity={0.9}
          className="mt-7 h-[50px] px-8 rounded-[28px] bg-terracotta flex-row items-center justify-center gap-2"
          accessibilityRole="button"
          accessibilityLabel={this.props.resetLabel ?? 'Go back'}>
          <RotateCcw color="#FFFFFF" size={17} />
          <Text className="text-white text-[18px] font-['InstrumentSerif-Regular']">
            {this.props.resetLabel ?? 'Go back'}
          </Text>
        </TouchableOpacity>

        {!showDetails ? (
          <TouchableOpacity
            onPress={() => this.setState({showDetails: true})}
            className="mt-5"
            accessibilityRole="button"
            accessibilityLabel="Show error details">
            <Text className="text-parchment-dim text-xs uppercase tracking-[0.8px] font-['InstrumentSans-SemiBold']">
              Show details
            </Text>
          </TouchableOpacity>
        ) : (
          <View className="mt-5 w-full max-h-[240px] rounded-xl bg-surface-1 border border-white/[0.08] p-3">
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-red-400 text-[12px] font-['InstrumentSans-SemiBold'] mb-1.5">
                {error.name}: {error.message}
              </Text>
              {error.stack ? (
                <Text className="text-parchment-dim text-[11px] leading-[16px] font-['InstrumentSans-Regular']">
                  {error.stack}
                </Text>
              ) : null}
            </ScrollView>
          </View>
        )}
      </View>
    );
  }
}

export default ErrorBoundary;
