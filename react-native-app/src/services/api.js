// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Change these to your machine's IP when running on a real device.
// Use 'localhost' for simulators / emulators.
const BASE_IP = '10.125.137.65'; // ← Change to your PC's local IP address

export const API_URLS = {
  rag: `http://${BASE_IP}:8080`,
  search: `http://${BASE_IP}:8082`,
  image: `http://${BASE_IP}:8084`,
};

// ─── RAG / Web-search chat ────────────────────────────────────────────────────

export const sendChatMessage = async (question, useWebFallback = true) => {
  const response = await fetch(`${API_URLS.rag}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      k: 3,
      temperature: 0.7,
      max_tokens: 512,
      use_web_fallback: useWebFallback,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Chat API error ${response.status}: ${err}`);
  }

  return response.json();
  // Returns { question, answer, sources, chunks_retrieved, model, timestamp, used_web_search }
};

// ─── Image analysis ───────────────────────────────────────────────────────────

export const analyzeImage = async (imageUri, imageType = 'image/jpeg') => {
  const filename = imageUri.split('/').pop();
  const formData = new FormData();

  formData.append('file', {
    uri: imageUri,
    name: filename,
    type: imageType,
  });

  const response = await fetch(`${API_URLS.image}/analyze`, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Image API error ${response.status}: ${err}`);
  }

  return response.json();
  // Returns { crop_identification, disease_detection, crop_description, treatment_advice, timestamp }
};

export const askAboutImage = async (imageUri, question, imageType = 'image/jpeg') => {
  const filename = imageUri.split('/').pop();
  const formData = new FormData();

  formData.append('file', {
    uri: imageUri,
    name: filename,
    type: imageType,
  });

  formData.append('question', question);

  const response = await fetch(`${API_URLS.image}/ask`, {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!response.ok) throw new Error(`Image ask error ${response.status}`);
  return response.json();
};

// ─── Health checks ────────────────────────────────────────────────────────────

export const checkHealth = async () => {
  const checks = await Promise.allSettled([
    fetch(`${API_URLS.rag}/health`).then((r) => r.json()),
    fetch(`${API_URLS.image}/health`).then((r) => r.json()),
    fetch(`${API_URLS.search}/health`).then((r) => r.json()),
  ]);

  return {
    rag: checks[0].status === 'fulfilled',
    image: checks[1].status === 'fulfilled',
    search: checks[2].status === 'fulfilled',
  };
};