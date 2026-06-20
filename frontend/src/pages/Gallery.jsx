import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLandmarks } from '../api';

export default function Gallery() {
  const [landmarks, setLandmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    getLandmarks().then(data => {
      setLandmarks(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const filtered = landmarks.filter(l =>
    l.name.toLowerCase().includes(filter.toLowerCase()) ||
    (l.city || '').toLowerCase().includes(filter.toLowerCase()) ||
    (l.country || '').toLowerCase().includes(filter.toLowerCase())
  );

  const countries = [...new Set(landmarks.map(l => l.country).filter(Boolean))].sort();

  return (
    <div className="gallery-page">
      <div className="gallery-header">
        <h1>Explore the World</h1>
        <p>Select a landmark to get AI-powered travel intelligence</p>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search landmarks, cities, or countries..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <div className="country-chips">
          <button className={!filter ? 'chip active' : 'chip'} onClick={() => setFilter('')}>All</button>
          {countries.map(c => (
            <button key={c} className={filter === c ? 'chip active' : 'chip'} onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <p>Loading landmarks...</p>
        </div>
      ) : (
        <div className="gallery-grid">
          {filtered.map(landmark => (
            <div key={landmark.id} className="landmark-card" onClick={() => navigate(`/explore/${landmark.id}`)}>
              <div className="card-image">
                {landmark.photo_url ? (
                  <img src={landmark.photo_url} alt={landmark.name} loading="lazy" />
                ) : (
                  <div className="placeholder-img">📸</div>
                )}
              </div>
              <div className="card-info">
                <h3>{landmark.name}</h3>
                <p className="card-location">{[landmark.city, landmark.country].filter(Boolean).join(', ')}</p>
                {landmark.category && <span className="card-category">{landmark.category}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
