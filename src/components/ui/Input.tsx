import React from 'react';
import {
  View, Text, TextInput, StyleSheet,
  TextInputProps, ViewStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { FontSize, FontWeight, Spacing, BorderRadius } from '../../constants';

interface InputProps extends TextInputProps {
  label?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label, required, containerStyle, error, ...props
}) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {label}
          {required && <Text style={{ color: theme.error }}> *</Text>}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.surfaceRaised,
            borderColor: error ? theme.error : theme.border,
          },
        ]}
        placeholderTextColor={theme.textTertiary}
        {...props}
      />
      {error && (
        <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
  },
  errorText: {
    fontSize: FontSize.xs,
  },
});
