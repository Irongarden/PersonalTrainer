import React from 'react';
import { View, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface LoadingSpinnerProps {
  fullScreen?: boolean;
  size?: 'small' | 'large';
  style?: ViewStyle;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  fullScreen = false, size = 'large', style,
}) => {
  const theme = useTheme();

  return (
    <View style={[
      fullScreen ? styles.fullScreen : styles.inline,
      style,
    ]}>
      <ActivityIndicator size={size} color={theme.primary} />
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
