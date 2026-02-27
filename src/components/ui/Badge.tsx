import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { FontSize, FontWeight, Spacing, BorderRadius } from '../../constants';

interface BadgeProps {
  label: string;
  color?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ label, color, size = 'sm' }) => {
  const theme = useTheme();
  const bg = color ? color + '22' : theme.primary + '22';
  const fg = color ?? theme.primary;

  return (
    <View style={[
      styles.badge,
      {
        backgroundColor: bg,
        paddingVertical: size === 'md' ? Spacing.xs : 2,
        paddingHorizontal: size === 'md' ? Spacing.sm : Spacing.xs,
      },
    ]}>
      <Text style={[styles.label, { color: fg, fontSize: size === 'md' ? FontSize.sm : FontSize.xs }]}>
        {label}
      </Text>
    </View>
  );
};

// PR Badge - gold star for personal records
export const PRBadge: React.FC = () => {
  return (
    <View style={styles.prBadge}>
      <Text style={styles.prText}>🏆 PR</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: FontWeight.semibold,
  },
  prBadge: {
    backgroundColor: '#F59E0B22',
    borderRadius: BorderRadius.full,
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs,
  },
  prText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#F59E0B',
  },
});
