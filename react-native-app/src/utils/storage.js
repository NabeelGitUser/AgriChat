import AsyncStorage from '@react-native-async-storage/async-storage';

const USERS_KEY = 'agrichat_users';
const CHATS_KEY_PREFIX = 'agrichat_chats_';

// ─── User Management ──────────────────────────────────────────────────────────

export const getUsers = async () => {
  try {
    const data = await AsyncStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveUser = async (user) => {
  const users = await getUsers();
  const exists = users.find((u) => u.email === user.email);
  if (exists) throw new Error('Email already registered');
  users.push(user);
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
  return user;
};

export const loginUser = async (email, password) => {
  const users = await getUsers();
  const user = users.find(
    (u) => u.email === email && u.password === password
  );
  if (!user) throw new Error('Invalid email or password');
  await AsyncStorage.setItem('currentUser', JSON.stringify(user));
  return user;
};

export const logoutUser = async () => {
  await AsyncStorage.removeItem('currentUser');
};

// ─── Chat History ─────────────────────────────────────────────────────────────

export const getChatsForUser = async (userId) => {
  try {
    const data = await AsyncStorage.getItem(CHATS_KEY_PREFIX + userId);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveChatSession = async (userId, session) => {
  const chats = await getChatsForUser(userId);
  const idx = chats.findIndex((c) => c.id === session.id);
  if (idx >= 0) {
    chats[idx] = session;
  } else {
    chats.unshift(session);
  }
  // Keep last 50 sessions
  const trimmed = chats.slice(0, 50);
  await AsyncStorage.setItem(
    CHATS_KEY_PREFIX + userId,
    JSON.stringify(trimmed)
  );
};

export const deleteChatSession = async (userId, sessionId) => {
  const chats = await getChatsForUser(userId);
  const filtered = chats.filter((c) => c.id !== sessionId);
  await AsyncStorage.setItem(
    CHATS_KEY_PREFIX + userId,
    JSON.stringify(filtered)
  );
};

export const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).substr(2, 5);