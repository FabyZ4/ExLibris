import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useExLibris } from '@/store/ExLibrisContext';
import { ExLibrisColors, ExLibrisMetrics } from '@/constants/theme';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ title, subtitle }) => {
  const { userRole } = useExLibris();

  return (
    <View style={styles.headerContainer}>
      <View style={styles.leftSection}>
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Ionicons name="book-outline" size={16} color={ExLibrisColors.textLight} />
          </View>
          <Text style={styles.brandTitle}>ExLibris</Text>
        </View>
        {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>

      <View style={styles.rightSection}>
        <View
          style={[
            styles.rolePill,
            userRole === 'moderador' ? styles.rolePillModerador : styles.rolePillLector,
          ]}
        >
          <Ionicons
            name={userRole === 'moderador' ? 'alert-circle-outline' : 'person-circle-outline'}
            size={13}
            color={userRole === 'moderador' ? ExLibrisColors.moderator : ExLibrisColors.primary}
          />
          <Text
            style={[
              styles.roleText,
              userRole === 'moderador' ? styles.roleTextModerador : styles.roleTextLector,
            ]}
          >
            {userRole === 'moderador' ? 'Mod' : 'Lector'}
          </Text>
        </View>

        <Pressable
          style={styles.iconButton}
          onPress={() => {}}
        >
          <Ionicons name="notifications-outline" size={20} color={ExLibrisColors.text} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ExLibrisMetrics.spacingMd,
    paddingVertical: ExLibrisMetrics.spacingSm,
    backgroundColor: ExLibrisColors.background,
    borderBottomWidth: 1,
    borderBottomColor: ExLibrisColors.border,
  },
  leftSection: {
    flex: 1,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: ExLibrisColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: ExLibrisColors.primary,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: ExLibrisColors.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: ExLibrisMetrics.radiusPill,
    gap: 4,
  },
  rolePillLector: {
    backgroundColor: ExLibrisColors.primaryMuted,
  },
  rolePillModerador: {
    backgroundColor: ExLibrisColors.moderatorLight,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  roleTextLector: {
    color: ExLibrisColors.primary,
  },
  roleTextModerador: {
    color: ExLibrisColors.moderator,
  },
  iconButton: {
    padding: 4,
  },
});
