import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../utils/theme';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isTyping = message.typing;

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.wrapper, isUser ? styles.wrapperUser : styles.wrapperBot]}>
      {/* Bot avatar */}
      {!isUser && (
        <View style={styles.botAvatar}>
          <Text style={styles.botAvatarText}>🌾</Text>
        </View>
      )}

      <View style={styles.bubbleColumn}>
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleBot,
          ]}
        >
          {isTyping ? (
            <View style={styles.typingDots}>
              <TypingDot delay={0} />
              <TypingDot delay={160} />
              <TypingDot delay={320} />
            </View>
          ) : (
            <Text
              style={[
                styles.bubbleText,
                isUser ? styles.bubbleTextUser : styles.bubbleTextBot,
              ]}
            >
              {message.content}
            </Text>
          )}
        </View>

        {/* Metadata row */}
        {!isTyping && (
          <View style={[styles.meta, isUser ? styles.metaUser : styles.metaBot]}>
            <Text style={styles.metaTime}>{formatTime(message.timestamp)}</Text>
            {message.used_web_search && (
              <View style={styles.webBadge}>
                <Text style={styles.webBadgeText}>🔍 Web</Text>
              </View>
            )}
            {message.sources && message.sources.length > 0 && (
              <View style={styles.kccBadge}>
                <Text style={styles.kccBadgeText}>📚 KCC</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* User avatar */}
      {isUser && (
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>👤</Text>
        </View>
      )}
    </View>
  );
}

function TypingDot({ delay }) {
  return <View style={[styles.dot, { animationDelay: `${delay}ms` }]} />;
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    paddingHorizontal: 12,
    gap: 8,
  },
  wrapperUser: { justifyContent: 'flex-end' },
  wrapperBot: { justifyContent: 'flex-start' },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  botAvatarText: { fontSize: 14 },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  userAvatarText: { fontSize: 14 },
  bubbleColumn: { maxWidth: '78%' },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: COLORS.userBubble,
    borderBottomRightRadius: 4,
    ...SHADOWS.sm,
  },
  bubbleBot: {
    backgroundColor: COLORS.botBubble,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.botBubbleBorder,
    ...SHADOWS.sm,
  },
  bubbleText: {
    fontSize: FONTS.sizes.md,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: COLORS.userBubbleText,
  },
  bubbleTextBot: {
    color: COLORS.botBubbleText,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  metaUser: { justifyContent: 'flex-end' },
  metaBot: { justifyContent: 'flex-start' },
  metaTime: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  webBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  webBadgeText: {
    fontSize: 10,
    color: '#1565C0',
    fontWeight: '600',
  },
  kccBadge: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  kccBadgeText: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '600',
  },
  typingDots: {
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textMuted,
    opacity: 0.6,
  },
});