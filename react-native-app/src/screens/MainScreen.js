import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, Animated,
  Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Sidebar from '../components/Sidebar';
import ProfileModal from '../components/ProfileModal';
import ImagePickerModal from '../components/ImagePickerModal';
import MessageBubble from '../components/MessageBubble';
import { sendChatMessage } from '../services/api';
import {
  getChatsForUser, saveChatSession, deleteChatSession, generateId,
} from '../utils/storage';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../utils/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const SIDEBAR_W = Math.min(SCREEN_W * 0.8, 320);

const WELCOME_MESSAGES = [
  'Ask me about crop diseases 🌿',
  'What fertilizer for paddy? 🌾',
  'Government schemes for farmers? 📋',
  'Best irrigation methods? 💧',
  'Soil testing tips? 🪱',
];

function createSession(firstMessage = '') {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: firstMessage
      ? firstMessage.slice(0, 45) + (firstMessage.length > 45 ? '...' : '')
      : 'New conversation',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export default function MainScreen({ currentUser, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);

  const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_W)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const history = await getChatsForUser(currentUser.id);
    setChatHistory(history);
    if (history.length > 0) {
      // Restore last session
      setActiveSession(history[0]);
      setMessages(history[0].messages);
    } else {
      startNewSession();
    }
  };

  const startNewSession = useCallback(() => {
    const session = createSession();
    setActiveSession(session);
    setMessages([]);
  }, []);

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.parallel([
      Animated.timing(sidebarAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeSidebar = () => {
    Animated.parallel([
      Animated.timing(sidebarAnim, {
        toValue: -SIDEBAR_W,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => setSidebarOpen(false));
  };

  const handleSelectChat = (session) => {
    setActiveSession(session);
    setMessages(session.messages);
  };

  const handleDeleteChat = async (sessionId) => {
    await deleteChatSession(currentUser.id, sessionId);
    const updated = chatHistory.filter((c) => c.id !== sessionId);
    setChatHistory(updated);
    if (activeSession?.id === sessionId) {
      if (updated.length > 0) {
        setActiveSession(updated[0]);
        setMessages(updated[0].messages);
      } else {
        startNewSession();
      }
    }
  };

  const persistSession = async (session, newMessages) => {
    const updated = {
      ...session,
      messages: newMessages,
      updatedAt: new Date().toISOString(),
      title:
        newMessages.find((m) => m.role === 'user')?.content.slice(0, 50) ||
        session.title,
    };
    setActiveSession(updated);
    await saveChatSession(currentUser.id, updated);
    const history = await getChatsForUser(currentUser.id);
    setChatHistory(history);
    return updated;
  };

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setInputText('');
    setSending(true);

    let session = activeSession;
    if (!session) {
      session = createSession(trimmed);
      setActiveSession(session);
    }

    const userMsg = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const typingMsg = {
      id: 'typing',
      role: 'assistant',
      content: '',
      typing: true,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg, typingMsg];
    setMessages(newMessages);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const data = await sendChatMessage(trimmed);

      const botMsg = {
        id: generateId(),
        role: 'assistant',
        content: data.answer,
        timestamp: new Date().toISOString(),
        used_web_search: data.used_web_search,
        sources: data.sources,
      };

      const finalMessages = [
        ...newMessages.filter((m) => m.id !== 'typing'),
        botMsg,
      ];
      setMessages(finalMessages);
      await persistSession(session, finalMessages);
    } catch (e) {
      const errMsg = {
        id: generateId(),
        role: 'assistant',
        content:
          '⚠️ Could not reach the AgriChat server. Please check that your backend is running and the IP address in api.js is correct.\n\nError: ' +
          e.message,
        timestamp: new Date().toISOString(),
      };
      const finalMessages = [
        ...newMessages.filter((m) => m.id !== 'typing'),
        errMsg,
      ];
      setMessages(finalMessages);
      await persistSession(session, finalMessages);
    }

    setSending(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
  };

  const handleImageAnalysisResult = async (analysisText) => {
    const botMsg = {
      id: generateId(),
      role: 'assistant',
      content: analysisText,
      timestamp: new Date().toISOString(),
    };

    let session = activeSession;
    if (!session) {
      session = createSession('Image Analysis');
      setActiveSession(session);
    }

    const finalMessages = [...messages, botMsg];
    setMessages(finalMessages);
    await persistSession(session, finalMessages);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
  };

  const handleSuggestedQuestion = (q) => sendMessage(q);

  return (
    <View style={styles.root}>
      {/* ── Sidebar overlay ────────────────────────────────────────── */}
      {sidebarOpen && (
        <Animated.View
          style={[styles.overlay, { opacity: overlayAnim }]}
          pointerEvents={sidebarOpen ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={closeSidebar}
            activeOpacity={1}
          />
        </Animated.View>
      )}

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.sidebar,
          { transform: [{ translateX: sidebarAnim }] },
        ]}
      >
        <Sidebar
          currentUser={currentUser}
          chatHistory={chatHistory}
          activeChatId={activeSession?.id}
          onNewChat={() => {
            startNewSession();
            closeSidebar();
          }}
          onSelectChat={(s) => {
            handleSelectChat(s);
            closeSidebar();
          }}
          onDeleteChat={handleDeleteChat}
          onProfilePress={() => {
            setProfileVisible(true);
            closeSidebar();
          }}
          onClose={closeSidebar}
        />
      </Animated.View>

      {/* ── Main chat area ─────────────────────────────────────────── */}
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={openSidebar}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.menuLine} />
              <View style={[styles.menuLine, { width: 16 }]} />
              <View style={styles.menuLine} />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>🌾 AgriChat</Text>
              <View style={styles.onlineDot} />
            </View>

            <TouchableOpacity
              style={styles.newBtn}
              onPress={startNewSession}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.newBtnText}>✏️</Text>
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <View style={styles.emptyChatIcon}>
                  <Text style={{ fontSize: 52 }}>🌱</Text>
                </View>
                <Text style={styles.emptyTitle}>
                  Hello, {currentUser.name.split(' ')[0]}!
                </Text>
                <Text style={styles.emptySubtitle}>
                  Ask me anything about farming, crops, diseases, or government schemes.
                </Text>

                {/* Suggested questions */}
                <View style={styles.suggestions}>
                  <Text style={styles.suggestionsLabel}>Try asking:</Text>
                  {WELCOME_MESSAGES.map((q, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.suggestionChip}
                      onPress={() => handleSuggestedQuestion(q)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.suggestionText}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Feature pills */}
                <View style={styles.featurePills}>
                  {['🌾 KCC Data', '🔍 Web Search', '📸 Image Analysis', '🗣️ Tamil Support'].map(
                    (f, i) => (
                      <View key={i} style={styles.featurePill}>
                        <Text style={styles.featurePillText}>{f}</Text>
                      </View>
                    )
                  )}
                </View>
              </View>
            }
            renderItem={({ item }) => <MessageBubble message={item} />}
          />

          {/* Input area */}
          <View style={styles.inputArea}>
            {/* Plus / image button */}
            <TouchableOpacity
              style={styles.plusBtn}
              onPress={() => setImageModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.plusBtnText}>+</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Ask about crops, diseases, schemes..."
              placeholderTextColor={COLORS.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              returnKeyType="default"
            />

            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!inputText.trim() || sending) && styles.sendBtnDisabled,
              ]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || sending}
              activeOpacity={0.85}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendBtnText}>↑</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Image hint tooltip */}
          <TouchableOpacity
            style={styles.imageHint}
            onPress={() => setImageModalVisible(true)}
          >
            <Text style={styles.imageHintText}>
              📸 Tap + to analyze crop images for disease detection
            </Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <ProfileModal
        visible={profileVisible}
        user={currentUser}
        onClose={() => setProfileVisible(false)}
        onLogout={onLogout}
      />

      <ImagePickerModal
        visible={imageModalVisible}
        onClose={() => setImageModalVisible(false)}
        onAnalysisResult={handleImageAnalysisResult}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  // ── Sidebar overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 10,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_W,
    zIndex: 20,
  },

  // ── Safe area
  safe: { flex: 1 },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    ...SHADOWS.sm,
  },
  menuBtn: { padding: 6, gap: 5, justifyContent: 'center' },
  menuLine: { width: 22, height: 2, backgroundColor: COLORS.textSecondary, borderRadius: 1 },
  headerCenter: { flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  onlineDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success,
  },
  newBtn: { padding: 6 },
  newBtnText: { fontSize: 20 },

  // ── Messages
  messageList: {
    paddingVertical: 12,
    paddingBottom: 8,
    flexGrow: 1,
  },

  // ── Empty state
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  emptyChatIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: COLORS.primaryMuted,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  suggestions: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  suggestionsLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    paddingLeft: 4,
  },
  suggestionChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primaryMuted,
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginBottom: 8,
    ...SHADOWS.sm,
  },
  suggestionText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  featurePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  featurePill: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  featurePillText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primaryDark,
    fontWeight: '600',
  },

  // ── Input
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: 8,
  },
  plusBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  plusBtnText: {
    fontSize: 24,
    color: COLORS.primary,
    lineHeight: 28,
    marginTop: -2,
    fontWeight: '400',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    maxHeight: 120,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
    ...SHADOWS.sm,
  },
  sendBtnDisabled: { backgroundColor: COLORS.primaryMuted },
  sendBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: -2,
  },

  // ── Image hint
  imageHint: {
    backgroundColor: COLORS.wheatLight,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#FEE08B',
  },
  imageHintText: {
    fontSize: FONTS.sizes.xs,
    color: '#7B6213',
    textAlign: 'center',
  },
});