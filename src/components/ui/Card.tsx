import React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';

type Tone = 'default' | 'elevated' | 'inset';

interface BaseProps {
  tone?: Tone;
  glow?: boolean;
  bordered?: boolean;
  className?: string;
  children?: React.ReactNode;
}

type StaticProps = BaseProps & Omit<ViewProps, 'children'>;
type PressProps = BaseProps & Omit<PressableProps, 'children'> & { onPress: PressableProps['onPress'] };

const toneClass: Record<Tone, string> = {
  default: 'bg-surface-1',
  elevated: 'bg-surface-2',
  inset: 'bg-surface-3',
};

function cardClass({
  tone = 'default',
  glow,
  bordered = true,
  className,
}: BaseProps): string {
  const border = bordered ? 'border border-brand-gold/20' : '';
  const glowCls = glow ? 'shadow-gold-glow' : '';
  return `rounded-2xl ${toneClass[tone]} ${border} ${glowCls} ${className ?? ''}`.trim();
}

export function Card(props: StaticProps) {
  const { tone, glow, bordered, className, children, ...rest } = props;
  return (
    <View className={cardClass({ tone, glow, bordered, className })} {...rest}>
      {children}
    </View>
  );
}

export function PressableCard(props: PressProps) {
  const { tone, glow, bordered, className, children, ...rest } = props;
  return (
    <Pressable
      className={cardClass({ tone, glow, bordered, className })}
      android_ripple={{ color: 'rgba(201,168,76,0.12)' }}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

export default Card;
