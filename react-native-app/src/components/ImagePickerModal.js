import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Image, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { analyzeImage } from '../services/api';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../utils/theme';

export default function ImagePickerModal({ visible, onClose, onAnalysisResult }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo access to analyze crop images.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]) {
      setSelectedImage(res.assets[0]);
      setResult(null);
    }
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access to analyze crop images.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]) {
      setSelectedImage(res.assets[0]);
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      Alert.alert('No image', 'Please select or capture an image first.');
      return;
    }
    setLoading(true);
    try {
      const data = await analyzeImage(selectedImage.uri);
      setResult(data);
    } catch (e) {
      Alert.alert(
        'Analysis failed',
        e.message.includes('fetch') 
          ? 'Cannot reach the image service. Make sure your backend is running and check the IP in api.js.'
          : e.message
      );
    }
    setLoading(false);
  };

  const handleSendToChat = () => {
    if (!result) return;
    const formatted = `📸 **Crop Image Analysis Result**

🌱 **Crop Identification:**
${result.crop_identification}

🦠 **Disease Detection:**
${result.disease_detection}

📋 **Crop Description:**
${result.crop_description}

💊 **Treatment Advice:**
${result.treatment_advice}`;
    onAnalysisResult(formatted);
    handleClose();
  };

  const handleClose = () => {
    setSelectedImage(null);
    setResult(null);
    setLoading(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>🌿 Crop Image Analysis</Text>
          <Text style={styles.subtitle}>
            Identify crops and detect diseases using AI
          </Text>

          {!result ? (
            <>
              {/* Image preview */}
              {selectedImage ? (
                <View style={styles.previewContainer}>
                  <Image
                    source={{ uri: selectedImage.uri }}
                    style={styles.preview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.changeBtn}
                    onPress={() => setSelectedImage(null)}
                  >
                    <Text style={styles.changeBtnText}>✕ Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.pickArea}>
                  <Text style={styles.pickIcon}>🌾</Text>
                  <Text style={styles.pickText}>
                    Select a crop image to analyze
                  </Text>
                  <View style={styles.pickButtons}>
                    <TouchableOpacity
                      style={styles.pickBtn}
                      onPress={pickFromGallery}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.pickBtnIcon}>🖼️</Text>
                      <Text style={styles.pickBtnText}>Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pickBtn}
                      onPress={pickFromCamera}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.pickBtnIcon}>📷</Text>
                      <Text style={styles.pickBtnText}>Camera</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Analyze button */}
              <TouchableOpacity
                style={[
                  styles.analyzeBtn,
                  (!selectedImage || loading) && styles.analyzeBtnDisabled,
                ]}
                onPress={handleAnalyze}
                disabled={!selectedImage || loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.analyzeBtnText}>Analyzing...</Text>
                  </View>
                ) : (
                  <Text style={styles.analyzeBtnText}>
                    🔍 Analyze Image
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            /* Results */
            <ScrollView style={styles.results} showsVerticalScrollIndicator={false}>
              {[
                { icon: '🌱', title: 'Crop Identification', value: result.crop_identification },
                { icon: '🦠', title: 'Disease Detection', value: result.disease_detection },
                { icon: '📋', title: 'Crop Description', value: result.crop_description },
                { icon: '💊', title: 'Treatment Advice', value: result.treatment_advice },
              ].map((section, i) => (
                <View key={i} style={styles.resultSection}>
                  <View style={styles.resultHeader}>
                    <Text style={styles.resultIcon}>{section.icon}</Text>
                    <Text style={styles.resultTitle}>{section.title}</Text>
                  </View>
                  <Text style={styles.resultText}>{section.value}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={styles.sendBtn}
                onPress={handleSendToChat}
                activeOpacity={0.85}
              >
                <Text style={styles.sendBtnText}>💬 Send to Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => { setResult(null); setSelectedImage(null); }}
              >
                <Text style={styles.retryBtnText}>Analyze another image</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeRow} onPress={handleClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 16,
    maxHeight: '95%',
  },
  handle: {
    width: 40, height: 4, backgroundColor: COLORS.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  title: {
    fontSize: FONTS.sizes.xl, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONTS.sizes.sm, color: COLORS.textMuted, marginBottom: 20,
  },
  pickArea: {
    borderWidth: 2, borderColor: COLORS.primaryMuted, borderStyle: 'dashed',
    borderRadius: RADIUS.lg, padding: 28, alignItems: 'center', marginBottom: 16,
    backgroundColor: COLORS.primarySoft,
  },
  pickIcon: { fontSize: 44, marginBottom: 10 },
  pickText: {
    fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: 20,
    textAlign: 'center',
  },
  pickButtons: { flexDirection: 'row', gap: 12 },
  pickBtn: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    paddingVertical: 12, alignItems: 'center', borderWidth: 1.5,
    borderColor: COLORS.primary, ...SHADOWS.sm,
  },
  pickBtnIcon: { fontSize: 22, marginBottom: 4 },
  pickBtnText: {
    fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.primary,
  },
  previewContainer: { borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: 16, ...SHADOWS.sm, minHeight: 200, backgroundColor: '#eee'  },
  preview: { width: '100%', height: 200, borderRadius: RADIUS.lg },
  changeBtn: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  changeBtnText: { color: '#fff', fontSize: FONTS.sizes.xs, fontWeight: '600' },
  analyzeBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 15, alignItems: 'center', marginBottom: 10, ...SHADOWS.sm,
  },
  analyzeBtnDisabled: { opacity: 0.4 },
  analyzeBtnText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  results: { maxHeight: '65%' },
  resultSection: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  resultIcon: { fontSize: 16 },
  resultTitle: {
    fontSize: FONTS.sizes.sm, fontWeight: '700', color: COLORS.primaryDark,
  },
  resultText: {
    fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20,
  },
  sendBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 14, alignItems: 'center', marginBottom: 10, ...SHADOWS.sm,
  },
  sendBtnText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: '700' },
  retryBtn: { paddingVertical: 10, alignItems: 'center' },
  retryBtnText: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },
  closeRow: { paddingTop: 8, alignItems: 'center' },
  closeText: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },
});