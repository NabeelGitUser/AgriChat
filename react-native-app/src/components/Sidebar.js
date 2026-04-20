import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, RADIUS } from '../utils/theme';
import { deleteChatSession } from '../utils/storage';

export default function Sidebar({
  currentUser,
  chatHistory,
  activeChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onProfilePress,
  onClose,
}) {
  const formatDate = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const handleDelete = (sessionId) => {
    Alert.alert('Delete chat?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDeleteChat(sessionId),
      },
    ]);
  };

  const initials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={styles.container}>
      {/* Brand header */}
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Text style={styles.brandEmoji}>🌾</Text>
          </View>
          <View>
            <Text style={styles.brandName}>AgriChat</Text>
            <Text style={styles.brandSub}>AI Farming Assistant</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* New chat button */}
      <TouchableOpacity
        style={styles.newChatBtn}
        onPress={() => { onNewChat(); onClose(); }}
        activeOpacity={0.85}
      >
        <Text style={styles.newChatPlus}>+</Text>
        <Text style={styles.newChatText}>New conversation</Text>
      </TouchableOpacity>

      {/* Section label */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>
          {chatHistory.length > 0 ? 'Recent chats' : 'No chats yet'}
        </Text>
      </View>

      {/* Chat list */}
      <FlatList
        data={chatHistory}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.chatItem,
              item.id === activeChatId && styles.chatItemActive,
            ]}
            onPress={() => { onSelectChat(item); onClose(); }}
            onLongPress={() => handleDelete(item.id)}
            activeOpacity={0.8}
          >
            <View style={styles.chatIcon}>
              <Text style={styles.chatIconText}>💬</Text>
            </View>
            <View style={styles.chatInfo}>
              <Text style={styles.chatTitle} numberOfLines={1}>
                {item.title || 'Untitled conversation'}
              </Text>
              <Text style={styles.chatDate}>{formatDate(item.updatedAt)}</Text>
            </View>
            {item.id === activeChatId && (
              <View style={styles.activeIndicator} />
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🌱</Text>
            <Text style={styles.emptyText}>
              Start a new conversation to get farming advice
            </Text>
          </View>
        }
      />

      {/* Profile button at bottom */}
      <SafeAreaView edges={['bottom']} style={styles.profileArea}>
        <View style={styles.profileDivider} />
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => { onProfilePress(); onClose(); }}
          activeOpacity={0.85}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {currentUser.name}
            </Text>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {currentUser.email}
            </Text>
          </View>
          <Text style={styles.profileArrow}>›</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.sidebarBg,
  },
  safeTop: {},
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandEmoji: { fontSize: 20 },
  brandName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.sidebarText,
  },
  brandSub: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.sidebarMuted,
    marginTop: 1,
  },
  closeBtn: {
    marginLeft: 'auto',
    padding: 8,
  },
  closeText: {
    fontSize: 18,
    color: COLORS.sidebarMuted,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: COLORS.sidebarActive,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  newChatPlus: {
    fontSize: 22,
    color: '#fff',
    lineHeight: 24,
    marginTop: -2,
  },
  newChatText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: '#fff',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.sidebarMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  list: { flex: 1 },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 6,
    borderRadius: RADIUS.md,
    gap: 10,
  },
  chatItemActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chatIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatIconText: { fontSize: 14 },
  chatInfo: { flex: 1 },
  chatTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    color: COLORS.sidebarText,
  },
  chatDate: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.sidebarMuted,
    marginTop: 2,
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.sidebarMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  profileArea: {},
  profileDivider: {
    height: 1,
    backgroundColor: COLORS.sidebarBorder,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: '#fff',
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.sidebarText,
  },
  profileEmail: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.sidebarMuted,
    marginTop: 1,
  },
  profileArrow: {
    fontSize: 20,
    color: COLORS.sidebarMuted,
  },
});