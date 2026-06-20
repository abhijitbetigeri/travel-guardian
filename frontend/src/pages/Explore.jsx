import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getLandmark, analyzeImage, chatWithAgent, createSafetyCheckin, recordVisit, getTravelMemory, getConversationMemory, saveConversationMemory, getTodayPlan, createTravelPlan, getPlanItems, addPlanItem, updatePlanItem, trackVisit, getVisitCount, uploadPhoto } from '../api';

export default function Explore({ token, user }) {
  const { id } = useParams();
  const [landmark, setLandmark] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [checkinSent, setCheckinSent] = useState(false);
  const [cached, setCached] = useState(false);
  const [travelMemory, setTravelMemory] = useState(null);
  const [convoMemory, setConvoMemory] = useState(null);
  const [prefsDetected, setPrefsDetected] = useState([]);
  const [visitCount, setVisitCount] = useState(0);
  const [todayPlan, setTodayPlan] = useState(null);
  const [planItems, setPlanItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState('landmark');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photos, setPhotos] = useState([]);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const userId = user?.id || 'demo-traveler';

  useEffect(() => {
    getLandmark(id).then(setLandmark);
    getTravelMemory(userId).then(setTravelMemory);
    getConversationMemory(userId, id).then(mem => {
      setConvoMemory(mem);
      if (mem?.summary) {
        setMessages([{
          role: 'assistant',
          content: `Welcome back! I remember our last conversation here. ${mem.summary}\n\nWhat else would you like to know?`
        }]);
      }
    });
    getVisitCount(userId, id).then(setVisitCount);
    getTodayPlan(userId).then(plan => {
      if (plan) {
        setTodayPlan(plan);
        getPlanItems(plan.id).then(items => setPlanItems(Array.isArray(items) ? items : []));
      }
    });
  }, [id]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAnalyze = async () => {
    if (!landmark?.photo_url) return;
    setAnalyzing(true);
    try {
      const result = await analyzeImage(landmark.photo_url, landmark.id);
      setAnalysis(result);
      setCached(!!result._cached);

      const memory = await recordVisit(userId, landmark, result);
      setTravelMemory(memory);

      const count = await trackVisit(userId, landmark);
      setVisitCount(count);

      const prevVisits = memory.visited.filter(v => v.landmarkId !== landmark.id).slice(0, 3);
      const memoryContext = prevVisits.length > 0
        ? `\n\nI see you've also visited: ${prevVisits.map(v => v.name).join(', ')}. I can compare or suggest connections!`
        : '';

      const visitNote = count > 1 ? `\n\n*This is your visit #${count} here!*` : '';

      const prefContext = memory.preferences && Object.keys(memory.preferences).length > 0
        ? `\n\n*I remember your preferences and will tailor my recommendations accordingly.*`
        : '';

      setMessages(prev => {
        const resumeMsg = prev.length > 0 ? prev : [];
        return [...resumeMsg, {
          role: 'assistant',
          content: `I've analyzed **${result.place_name || landmark.name}** in ${result.city || landmark.city}, ${result.country || landmark.country}.\n\n**${result.significance || ''}**${visitNote}${memoryContext}${prefContext}\n\nFeel free to ask me about restaurants, safety, attractions, or anything else about this place!`
        }];
      });

      if (!todayPlan) {
        const plan = await createTravelPlan(userId, landmark.city, landmark.country);
        setTodayPlan(plan);
      }
    } catch (e) {
      setAnalysis({ error: 'Analysis failed. Try again.' });
    }
    setAnalyzing(false);
  };

  const handleChat = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setChatLoading(true);

    const reply = await chatWithAgent(newMessages, { landmark, analysis, travelMemory, convoMemory });
    const allMessages = [...newMessages, { role: 'assistant', content: reply }];
    setMessages(allMessages);
    setChatLoading(false);

    const savedConvo = await saveConversationMemory(userId, id, allMessages);
    setConvoMemory(savedConvo);
    if (savedConvo.preferences?.length > 0) {
      setPrefsDetected(savedConvo.preferences);
      const updatedMemory = await getTravelMemory(userId);
      setTravelMemory(updatedMemory);
    }
  };

  const handleAddPlanItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim() || !todayPlan) return;
    const item = await addPlanItem(todayPlan.id, {
      type: newItemType,
      name: newItemName,
      landmark_id: newItemType === 'landmark' ? landmark?.id : null,
      visited: false,
      visit_order: planItems.length + 1,
    });
    setPlanItems(prev => [...prev, item]);
    setNewItemName('');
  };

  const handleToggleVisited = async (item) => {
    await updatePlanItem(item.id, { visited: !item.visited });
    setPlanItems(prev => prev.map(i => i.id === item.id ? { ...i, visited: !i.visited } : i));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const objectId = await uploadPhoto(file);
      setPhotos(prev => [...prev, { id: objectId, name: file.name, preview: URL.createObjectURL(file) }]);
      if (todayPlan) {
        const currentItem = planItems.find(i => i.landmark_id === landmark?.id);
        if (currentItem) {
          const existingPhotos = currentItem.photo_ids || [];
          await updatePlanItem(currentItem.id, { photo_ids: [...existingPhotos, objectId] });
        }
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploadingPhoto(false);
  };

  const handleCheckin = async () => {
    if (!landmark) return;
    const checkin = {
      traveler_id: user?.id || '00000000-0000-0000-0000-000000000001',
      guardian_id: '00000000-0000-0000-0000-000000000002',
      landmark_id: landmark.id,
      status: 'safe',
      ai_summary: `Traveler is exploring ${landmark.name} in ${landmark.city}, ${landmark.country}. Visit #${visitCount || 1}. Current conditions appear safe. AI analysis: ${analysis?.scene_description || 'No scene analysis available.'}`,
      latitude: landmark.latitude,
      longitude: landmark.longitude,
    };
    await createSafetyCheckin(token, checkin);
    setCheckinSent(true);
    setTimeout(() => setCheckinSent(false), 3000);
  };

  if (!landmark) return <div className="loading"><div className="spinner" /><p>Loading...</p></div>;

  return (
    <div className="explore-page">
      <div className="explore-layout">
        <div className="explore-left">
          <div className="explore-image">
            {landmark.photo_url ? (
              <img src={landmark.photo_url} alt={landmark.name} />
            ) : (
              <div className="placeholder-img large">📸</div>
            )}
            {visitCount > 0 && (
              <div className="visit-badge">Visit #{visitCount}</div>
            )}
          </div>

          <div className="explore-info">
            <h1>{landmark.name}</h1>
            <p className="location-text">📍 {[landmark.city, landmark.state, landmark.country].filter(Boolean).join(', ')}</p>
            {landmark.category && <span className="category-badge">{landmark.category}</span>}
          </div>

          <div className="explore-actions">
            <button onClick={handleAnalyze} disabled={analyzing} className="btn-primary">
              {analyzing ? '🔍 Analyzing...' : '🤖 AI Scene Analysis'}
            </button>
            <button onClick={handleCheckin} className="btn-secondary">
              {checkinSent ? '✅ Sent!' : '🛡️ Send Safety Check-in'}
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="btn-secondary" disabled={uploadingPhoto}>
              {uploadingPhoto ? '📤 Uploading...' : '📸 Upload Photo'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            {cached && <span className="cache-badge">⚡ Cached</span>}
          </div>

          {photos.length > 0 && (
            <div className="photos-panel">
              <h4>📸 Your Photos</h4>
              <div className="photos-grid">
                {photos.map((p, i) => (
                  <img key={i} src={p.preview} alt={p.name} className="photo-thumb" />
                ))}
              </div>
            </div>
          )}

          {travelMemory && travelMemory.visited.length > 0 && (
            <div className="memory-panel">
              <h4>🧠 Your Travel Memory</h4>
              <p className="memory-count">{travelMemory.visited.length} places visited</p>
              <div className="memory-list">
                {travelMemory.visited.slice(0, 5).map((v, i) => (
                  <div key={i} className="memory-item">
                    <span className="memory-name">{v.name}</span>
                    <span className="memory-location">{v.city}, {v.country}</span>
                  </div>
                ))}
              </div>
              {travelMemory.preferences && Object.keys(travelMemory.preferences).length > 0 && (
                <div className="prefs-section">
                  <h4>🎯 Learned Preferences</h4>
                  <div className="prefs-chips">
                    {Object.entries(travelMemory.preferences).map(([cat, vals]) =>
                      vals.map((v, i) => (
                        <span key={`${cat}-${i}`} className="pref-chip">{v}</span>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="plan-panel">
            <h4>📋 Today's Travel Plan</h4>
            {!todayPlan ? (
              <p className="plan-hint">Click "AI Scene Analysis" to start today's plan</p>
            ) : (
              <>
                <p className="plan-meta">{todayPlan.city}, {todayPlan.country} — {todayPlan.plan_date}</p>
                <div className="plan-items">
                  {planItems.map((item, i) => (
                    <div key={item.id || i} className={`plan-item ${item.visited ? 'visited' : ''}`} onClick={() => handleToggleVisited(item)}>
                      <span className="plan-check">{item.visited ? '✅' : '⬜'}</span>
                      <span className="plan-type-badge">{item.type}</span>
                      <span className="plan-item-name">{item.name}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddPlanItem} className="plan-add">
                  <select value={newItemType} onChange={e => setNewItemType(e.target.value)}>
                    <option value="landmark">Landmark</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="activity">Activity</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Add to plan..."
                    value={newItemName}
                    onChange={e => setNewItemName(e.target.value)}
                  />
                  <button type="submit" disabled={!newItemName.trim()}>+</button>
                </form>
              </>
            )}
          </div>

          {analysis && !analysis.error && (
            <div className="analysis-panel">
              <h3>AI Analysis</h3>
              {analysis.significance && (
                <div className="analysis-section">
                  <h4>Significance</h4>
                  <p>{analysis.significance}</p>
                </div>
              )}
              {analysis.safety_tips?.length > 0 && (
                <div className="analysis-section">
                  <h4>🛡️ Safety Tips</h4>
                  <ul>{analysis.safety_tips.map((tip, i) => <li key={i}>{tip}</li>)}</ul>
                </div>
              )}
              {analysis.nearby_attractions?.length > 0 && (
                <div className="analysis-section">
                  <h4>📍 Nearby Attractions</h4>
                  <ul>{analysis.nearby_attractions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </div>
              )}
              {analysis.best_time_to_visit && (
                <div className="analysis-section">
                  <h4>🕐 Best Time to Visit</h4>
                  <p>{analysis.best_time_to_visit}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="explore-right">
          <div className="chat-panel">
            <div className="chat-header">
              <h3>💬 Chat with TravelGuardian AI</h3>
              <p>Ask about restaurants, safety, culture, or anything!</p>
              {convoMemory?.summary && (
                <p className="convo-resume">🔄 Conversation memory loaded</p>
              )}
            </div>
            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="chat-empty">
                  <p>Click "AI Scene Analysis" first, then ask me anything about this place!</p>
                  <div className="suggested-questions">
                    <button onClick={() => setInput('What vegetarian restaurants are nearby?')}>🥗 Vegetarian food?</button>
                    <button onClick={() => setInput('Is this area safe for solo travelers at night?')}>🛡️ Solo night safety?</button>
                    <button onClick={() => setInput('What museums or art galleries are nearby?')}>🎨 Nearby museums?</button>
                    <button onClick={() => setInput('Best local street food around here?')}>🍜 Street food?</button>
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`chat-msg ${msg.role}`}>
                  <div className="msg-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
                  <div className="msg-content">{msg.content}</div>
                </div>
              ))}
              {chatLoading && (
                <div className="chat-msg assistant">
                  <div className="msg-avatar">🤖</div>
                  <div className="msg-content typing">Thinking...</div>
                </div>
              )}
              {prefsDetected.length > 0 && (
                <div className="prefs-detected">
                  🧠 Learned: {prefsDetected.map(p => p.value).join(', ')}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleChat} className="chat-input">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about this place..."
                disabled={chatLoading}
              />
              <button type="submit" disabled={chatLoading || !input.trim()}>Send</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
