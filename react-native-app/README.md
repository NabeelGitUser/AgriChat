# 🌾 AgriChat - React Native App

A trilingual AI-powered agricultural chatbot for Tamil Nadu farmers.
Built with Expo + React Native, integrating your RAG/KCC backend.

---

## 📱 Features

- **Login & Registration** — per-user accounts stored locally (AsyncStorage)
- **Chat Interface** — Claude-like UI with agricultural green theme
- **Sidebar Drawer** — chat history with swipe/long-press to delete
- **Profile Panel** — name, email, join date, logout
- **Image Analysis** — tap `+` → select/camera → analyze crop disease via llava:7b
- **Trilingual** — English, Tamil script, Tanglish all supported
- **Auto web fallback** — KCC database first, then web search if needed

---

## 🚀 Setup

### 1. Install Expo CLI
```bash
npm install -g expo-cli
```

### 2. Install dependencies
```bash
cd AgriChat
npm install
```

### 3. ⚠️ Set your backend IP

Open `src/services/api.js` and change:
```js
const BASE_IP = '192.168.1.100'; // ← Your PC's local IP
```

Find your IP:
- **Linux/Mac**: `ip addr show` or `ifconfig`
- **Windows**: `ipconfig`

Use the IP from your WiFi adapter (not 127.0.0.1 — that won't work on a physical device).

### 4. Start your Docker services
```bash
cd ~/Final\ Year\ Project/AgriChat
docker-compose up
```

Services must be running:
- RAG service: http://YOUR_IP:8080
- Image service: http://YOUR_IP:8084
- Search service: http://YOUR_IP:8082

### 5. Run the app
```bash
cd AgriChat
npx expo start
```

Scan the QR code with **Expo Go** app (Android/iOS), or press:
- `a` for Android emulator
- `i` for iOS simulator

---

## 📁 Project Structure

```
AgriChat/
├── App.js                      # Root with auth routing
├── app.json                    # Expo config
├── babel.config.js
├── package.json
└── src/
    ├── screens/
    │   ├── LoginScreen.js      # Login page
    │   ├── RegisterScreen.js   # Registration page
    │   └── MainScreen.js       # Main chat interface
    ├── components/
    │   ├── Sidebar.js          # Left drawer with chat history
    │   ├── ProfileModal.js     # Profile bottom sheet
    │   ├── ImagePickerModal.js # Crop image analysis
    │   └── MessageBubble.js    # Individual chat message
    ├── services/
    │   └── api.js              # Backend API calls
    └── utils/
        ├── storage.js          # AsyncStorage helpers
        └── theme.js            # Colors, fonts, spacing
```

---

## 🎨 Theme

Agricultural green palette:
- Primary: `#2D7A4F` (forest green)
- Accent: `#8BC34A` (leaf green)
- Background: `#F4FBF6` (pale green tint)
- Sidebar: `#1B3A2A` (dark forest)

---

## 🔌 API Endpoints Used

| Feature | Endpoint |
|---------|----------|
| Chat (RAG + web) | POST `http://IP:8080/chat` |
| Image analysis | POST `http://IP:8084/analyze` |
| Web search | Auto-triggered by RAG service |

---

## 📲 Building APK (optional)

```bash
npx expo build:android
# or with EAS (recommended):
npm install -g eas-cli
eas build --platform android
```

---

## 🐛 Troubleshooting

**"Cannot reach server"** → Check `BASE_IP` in `api.js`. Must be your PC's WiFi IP, not localhost.

**"Image analysis failed"** → Make sure `docker-compose up` is running and `llava:7b` model is pulled.

**Slow responses** → Normal with Gemma 3 4B on CPU. Tanglish queries take longer due to translation.