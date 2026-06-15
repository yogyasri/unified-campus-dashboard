'use client';

import { useEffect, useState, useCallback } from 'react';
import { HiOutlineBuildingStorefront, HiOutlineArrowPath, HiOutlineHeart } from 'react-icons/hi2';
import { useToast } from '../context/ToastContext';

interface MenuItem {
  id: number;
  item_name: string;
  category: string;
  calories: number;
  is_vegetarian: number;
  price: number;
}

interface CafeteriaData {
  day: string;
  currentMeal: string;
  items: MenuItem[];
  time: string;
}

export default function CafeteriaCard() {
  const [data, setData] = useState<CafeteriaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [favoriteState, setFavoriteState] = useState<Record<number, 'idle' | 'loading' | 'done'>>({});
  const { showToast } = useToast();

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [menuRes, favRes] = await Promise.all([
        fetch('/api/cafeteria'),
        fetch('/api/cafeteria/my-favorites')
      ]);
      if (!menuRes.ok) throw new Error('Failed to fetch menu');
      const menuResult = await menuRes.json();
      let favIds: number[] = [];
      if (favRes.ok) {
        const favResult = await favRes.json();
        favIds = favResult.favoriteIds || [];
      }
      
      const sortedItems = [...(menuResult.items || [])].sort((a, b) => {
        const aFav = favIds.includes(a.id) ? 1 : 0;
        const bFav = favIds.includes(b.id) ? 1 : 0;
        return bFav - aFav; // Favorites first
      });

      setData({ ...menuResult, items: sortedItems });
      
      // Initialize favoriteState for already favorited items
      const initialFavState: Record<number, 'idle' | 'loading' | 'done'> = {};
      favIds.forEach(id => {
        initialFavState[id] = 'done';
      });
      setFavoriteState(initialFavState);
      setLastUpdated(new Date());
      setError('');
    } catch {
      if (!silent) setError('Unable to connect to cafeteria');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleFavorite = async (item: MenuItem) => {
    if (favoriteState[item.id] === 'done') return;

    // Optimistic update — flip heart immediately
    setFavoriteState((prev) => ({ ...prev, [item.id]: 'loading' }));
    // Immediately mark as done (optimistic)
    setTimeout(() => setFavoriteState((prev) => ({ ...prev, [item.id]: 'done' })), 100);

    try {
      const res = await fetch('/api/cafeteria/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || 'Failed');
      showToast(`❤️ "${item.item_name}" added to favorites!`, 'success');
    } catch {
      // Revert
      setFavoriteState((prev) => ({ ...prev, [item.id]: 'idle' }));
      showToast(`Network timeout. Could not save favorite.`, 'error');
    }
  };

  const mealEmoji = data?.currentMeal === 'breakfast' ? '🌅' : data?.currentMeal === 'lunch' ? '☀️' : '🌙';

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(245, 158, 11, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HiOutlineBuildingStorefront size={20} style={{ color: 'var(--accent-amber)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Cafeteria</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="live-indicator" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Serving now'}
              </span>
            </div>
          </div>
        </div>
        <button onClick={() => fetchData()} className="btn-ghost" style={{ padding: 6, borderRadius: 8 }}>
          <HiOutlineArrowPath size={16} />
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="skeleton" style={{ height: 40, borderRadius: 12 }} />
          <div className="skeleton" style={{ height: 20 }} />
          <div className="skeleton" style={{ height: 20 }} />
          <div className="skeleton" style={{ height: 20, width: '60%' }} />
        </div>
      ) : error ? (
        <p style={{ color: 'var(--accent-red)', fontSize: 13 }}>{error}</p>
      ) : data && (
        <>
          {/* Current Meal Banner */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 12, marginBottom: 14,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(236,72,153,0.08))',
            border: '1px solid rgba(245,158,11,0.15)',
          }}>
            <span style={{ fontSize: 22 }}>{mealEmoji}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>
                Currently Serving: {data.currentMeal}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{data.day}</div>
            </div>
          </div>

          {/* Menu Items with Favorite */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.items.slice(0, 4).map((item) => {
              const state = favoriteState[item.id] || 'idle';
              return (
                <div key={item.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', borderRadius: 8, background: 'var(--glass)',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {item.item_name}
                      {item.is_vegetarian === 1 && <span style={{ fontSize: 10, color: 'var(--accent-green)' }}>🌿</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.calories} cal</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-amber)' }}>
                      ₹{(item.price * 84).toFixed(0)}
                    </span>
                    <button
                      onClick={() => handleFavorite(item)}
                      disabled={state === 'loading'}
                      title={state === 'done' ? 'Favorited!' : 'Mark as favorite'}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: 4, borderRadius: 6,
                        color: state === 'done' ? 'var(--accent-red)' : 'var(--text-muted)',
                        transition: 'all 0.2s ease',
                        transform: state === 'done' ? 'scale(1.2)' : 'scale(1)',
                      }}
                    >
                      <HiOutlineHeart size={16} style={{ fill: state === 'done' ? 'var(--accent-red)' : 'none' }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
