import { API_URL, AI_MODEL, SERVICE_KEY } from './config';

function headers(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token || SERVICE_KEY}`,
  };
}

export async function signup(email, password, displayName) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
  return res.json();
}

export async function login(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function getLandmarks() {
  const res = await fetch(`${API_URL}/landmarks?select=*&order=name.asc&limit=50`, {
    headers: headers(),
  });
  return res.json();
}

export async function getLandmark(id) {
  const res = await fetch(`${API_URL}/landmarks?id=eq.${id}`, {
    headers: headers(),
  });
  const data = await res.json();
  return data[0];
}

// --- KV Store (Butterbase persistent cache) ---

export async function kvGet(key) {
  const res = await fetch(`${API_URL}/kv/${encodeURIComponent(key)}`, {
    headers: headers(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.value ? JSON.parse(data.value) : null;
}

export async function kvSet(key, value, ttl = 86400) {
  await fetch(`${API_URL}/kv/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ value: JSON.stringify(value), ttl }),
  });
}

// --- AI Analysis (with KV caching) ---

export async function analyzeImage(imageUrl, landmarkId) {
  if (landmarkId) {
    const cached = await kvGet(`analysis:${landmarkId}`);
    if (cached) return cached;
  }

  const res = await fetch(`${API_URL}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{
        role: 'system',
        content: `You are TravelGuardian AI, an expert travel intelligence agent. When shown an image of a place, provide a comprehensive analysis. Always respond in valid JSON with these keys:
- place_name: string
- city: string
- country: string
- significance: string (2-3 sentences about historical/cultural significance)
- scene_description: string (what you observe in the image)
- safety_tips: string[] (3 practical safety tips)
- nearby_attractions: string[] (3 likely nearby attractions)
- best_time_to_visit: string
- local_emergency_number: string`
      }, {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this travel destination.' },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }],
      max_tokens: 1000,
    }),
  });
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/(\{[\s\S]*\})/);
  const result = jsonMatch ? JSON.parse(jsonMatch[1]) : { raw: content };

  if (landmarkId && !result.raw) {
    await kvSet(`analysis:${landmarkId}`, result);
  }

  return result;
}

// --- Travel Memory (KV-based per-user persistent state) ---

export async function getTravelMemory(userId) {
  return await kvGet(`memory:${userId}`) || { visited: [], preferences: {}, lastLocation: null };
}

export async function updateTravelMemory(userId, memory) {
  await kvSet(`memory:${userId}`, memory, 604800); // 7 day TTL
}

export async function recordVisit(userId, landmark, analysis) {
  const memory = await getTravelMemory(userId);
  const visit = {
    landmarkId: landmark.id,
    name: landmark.name,
    city: landmark.city,
    country: landmark.country,
    visitedAt: new Date().toISOString(),
    aiSummary: analysis?.significance || null,
  };
  memory.visited = [visit, ...memory.visited.filter(v => v.landmarkId !== landmark.id)].slice(0, 50);
  memory.lastLocation = { lat: landmark.latitude, lon: landmark.longitude, name: landmark.name };
  await updateTravelMemory(userId, memory);
  return memory;
}

// --- Conversation Memory (persisted per landmark per user) ---

export async function getConversationMemory(userId, landmarkId) {
  return await kvGet(`convo:${userId}:${landmarkId}`) || { summary: null, preferences: [] };
}

export async function saveConversationMemory(userId, landmarkId, messages) {
  const userMsgs = messages.filter(m => m.role === 'user').map(m => m.content);

  const prefKeywords = {
    cuisine: ['vegetarian', 'vegan', 'halal', 'kosher', 'seafood', 'local food', 'street food', 'fine dining', 'budget', 'cheap eats'],
    safety: ['solo', 'family', 'kids', 'night', 'women', 'elderly'],
    interests: ['museum', 'art', 'history', 'nature', 'hiking', 'beach', 'nightlife', 'shopping', 'temple', 'church', 'architecture'],
    mobility: ['wheelchair', 'accessible', 'walking', 'public transport', 'taxi'],
  };

  const detectedPrefs = [];
  const allText = userMsgs.join(' ').toLowerCase();
  for (const [category, keywords] of Object.entries(prefKeywords)) {
    for (const kw of keywords) {
      if (allText.includes(kw)) detectedPrefs.push({ category, value: kw });
    }
  }

  const memory = {
    summary: userMsgs.length > 0 ? `User asked about: ${userMsgs.slice(-3).join('; ')}` : null,
    preferences: detectedPrefs,
    lastChat: new Date().toISOString(),
    messageCount: messages.length,
  };

  await kvSet(`convo:${userId}:${landmarkId}`, memory, 604800);

  if (detectedPrefs.length > 0) {
    const userMemory = await getTravelMemory(userId);
    const existingPrefs = userMemory.preferences || {};
    for (const p of detectedPrefs) {
      if (!existingPrefs[p.category]) existingPrefs[p.category] = [];
      if (!existingPrefs[p.category].includes(p.value)) {
        existingPrefs[p.category].push(p.value);
      }
    }
    userMemory.preferences = existingPrefs;
    await updateTravelMemory(userId, userMemory);
  }

  return memory;
}

// --- AI Chat (with persistent memory context) ---

export async function chatWithAgent(messages, { landmark, analysis, travelMemory, convoMemory } = {}) {
  const userMessages = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  let memoryContext = '';

  if (travelMemory?.visited?.length > 0) {
    const pastPlaces = travelMemory.visited
      .filter(v => v.landmarkId !== landmark?.id)
      .slice(0, 5)
      .map(v => `${v.name} (${v.city}, ${v.country})`)
      .join(', ');
    if (pastPlaces) memoryContext += `\n\nTraveler's past visits: ${pastPlaces}.`;
  }

  if (travelMemory?.preferences && Object.keys(travelMemory.preferences).length > 0) {
    const prefs = Object.entries(travelMemory.preferences)
      .map(([cat, vals]) => `${cat}: ${vals.join(', ')}`)
      .join('; ');
    memoryContext += `\nTraveler's known preferences: ${prefs}. Tailor recommendations to these preferences without being asked.`;
  }

  if (convoMemory?.summary) {
    memoryContext += `\nPrevious conversation at this location: ${convoMemory.summary}`;
  }

  const locationContext = analysis
    ? `Current location: ${analysis.place_name || landmark?.name} in ${analysis.city || landmark?.city}, ${analysis.country || landmark?.country}. Scene: ${analysis.scene_description || ''}`
    : landmark
    ? `Current location: ${landmark.name} in ${landmark.city}, ${landmark.country}.`
    : '';

  const systemMsg = {
    role: 'system',
    content: `You are TravelGuardian AI, a friendly and knowledgeable travel assistant with persistent memory. You remember the traveler's past visits, preferences, and conversations.

${locationContext}${memoryContext}

Use your memory of the traveler to give personalized recommendations. If they've visited similar places before, draw comparisons. If you know their food preferences, suggest matching restaurants without being asked. If they care about safety, proactively mention relevant tips. Be concise but helpful.`
  };

  const res = await fetch(`${API_URL}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [systemMsg, ...userMessages],
      max_tokens: 500,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'Sorry, I could not process that.';
}

// --- Travel Plans (Database) ---

export async function getTodayPlan(userId) {
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`${API_URL}/travel_plans?user_id=eq.${userId}&plan_date=eq.${today}&limit=1`, {
    headers: headers(),
  });
  const data = await res.json();
  return Array.isArray(data) ? data[0] : null;
}

export async function createTravelPlan(userId, city, country) {
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`${API_URL}/travel_plans`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ user_id: userId, plan_date: today, city, country, status: 'active' }),
  });
  return res.json();
}

export async function getPlanItems(planId) {
  const res = await fetch(`${API_URL}/plan_items?plan_id=eq.${planId}&order=visit_order.asc`, {
    headers: headers(),
  });
  return res.json();
}

export async function addPlanItem(planId, item) {
  const res = await fetch(`${API_URL}/plan_items`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ plan_id: planId, ...item }),
  });
  return res.json();
}

export async function updatePlanItem(itemId, updates) {
  const res = await fetch(`${API_URL}/plan_items?id=eq.${itemId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(updates),
  });
  return res.json();
}

// --- Visit Tracking (Database + KV counter) ---

export async function trackVisit(userId, landmark, photoIds = []) {
  const kvKey = `visits:${userId}:${landmark.id}`;
  const existing = await kvGet(kvKey);
  const count = (existing?.count || 0) + 1;

  await kvSet(kvKey, { count, lastVisited: new Date().toISOString() }, 604800);

  const dbRes = await fetch(`${API_URL}/visits?user_id=eq.${userId}&landmark_id=eq.${landmark.id}&limit=1`, {
    headers: headers(),
  });
  const dbData = await dbRes.json();

  if (Array.isArray(dbData) && dbData.length > 0) {
    const existingPhotos = dbData[0].photos || [];
    await fetch(`${API_URL}/visits?id=eq.${dbData[0].id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({
        visit_count: count,
        last_visited: new Date().toISOString(),
        photos: [...existingPhotos, ...photoIds],
      }),
    });
  } else {
    await fetch(`${API_URL}/visits`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        user_id: userId,
        landmark_id: landmark.id,
        visit_count: count,
        last_visited: new Date().toISOString(),
        photos: photoIds,
      }),
    });
  }

  return count;
}

export async function getVisitCount(userId, landmarkId) {
  const cached = await kvGet(`visits:${userId}:${landmarkId}`);
  return cached?.count || 0;
}

export async function getUserVisits(userId) {
  const res = await fetch(`${API_URL}/visits?user_id=eq.${userId}&order=last_visited.desc&limit=20`, {
    headers: headers(),
  });
  return res.json();
}

// --- Photo Storage ---

export async function getUploadUrl(filename, contentType, sizeBytes) {
  const res = await fetch(`${API_URL}/storage/upload`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ filename, content_type: contentType, size_bytes: sizeBytes }),
  });
  return res.json();
}

export async function uploadPhoto(file) {
  const { uploadUrl, object_id } = await getUploadUrl(file.name, file.type, file.size);
  await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  return object_id;
}

export async function getDownloadUrl(objectId) {
  const res = await fetch(`${API_URL}/storage/download/${objectId}`, {
    headers: headers(),
  });
  return res.json();
}

export async function createSafetyCheckin(token, data) {
  const res = await fetch(`${API_URL}/safety_checkins`, {
    method: 'POST',
    headers: headers(token || SERVICE_KEY),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getSafetyCheckins(guardianId) {
  const res = await fetch(`${API_URL}/safety_checkins?guardian_id=eq.${guardianId}&order=created_at.desc&limit=20`, {
    headers: headers(),
  });
  return res.json();
}

export async function linkGuardian(token, travelerId, guardianId) {
  const res = await fetch(`${API_URL}/guardian_links`, {
    method: 'POST',
    headers: headers(token || SERVICE_KEY),
    body: JSON.stringify({ traveler_id: travelerId, guardian_id: guardianId, status: 'active' }),
  });
  return res.json();
}
