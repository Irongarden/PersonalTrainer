import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { FontSize, FontWeight, Spacing, BorderRadius, TOUCH_TARGET } from '../../constants';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, fullWidth = false, style,
}) => {
  const theme = useTheme();

  const bgColor: Record<string, string> = {
    primary: theme.primary,
    secondary: theme.surfaceHighlight,
    danger: theme.error,
    ghost: 'transparent',
  };

  const textColor: Record<string, string> = {
    primary: '#FFFFFF',
    secondary: theme.text,
    danger: '#FFFFFF',
    ghost: theme.primary,
  };

  const padV: Record<string, number> = { sm: Spacing.xs, md: Spacing.sm, lg: Spacing.md };
  const padH: Record<string, number> = { sm: Spacing.sm, md: Spacing.md, lg: Spacing.lg };
  const fSize: Record<string, number> = { sm: FontSize.sm, md: FontSize.md, lg: FontSize.lg };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.base,
        {
          backgroundColor: bgColor[variant],
          paddingVertical: padV[size],
          paddingHorizontal: padH[size],
          minHeight: size === 'sm' ? 32 : TOUCH_TARGET,
          opacity: disabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: theme.primary,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor[variant]} size="small" />
      ) : (
        <Text style={[
          styles.label,
          { color: textColor[variant], fontSize: fSize[size] },
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: {
    fontWeight: FontWeight.semibold,
  },
});
