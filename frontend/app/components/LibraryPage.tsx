'use client';

import { useEffect, useState, useCallback } from 'react';
import { HiOutlineBookOpen, HiOutlineCheckCircle, HiOutlineBookmark, HiOutlineMapPin, HiOutlineMagnifyingGlass } from 'react-icons/hi2';
import { useToast } from '../context/ToastContext';

interface Book {
  id: number;
  title: string;
  author: string;
  genre: string;
  available: number;
  total_copies: number;
  borrowed: number;
  location: string;
}

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [borrowedIds, setBorrowedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionState, setActionState] = useState<Record<number, 'idle' | 'loading' | 'borrowed' | 'held'>>({});
  const { showToast } = useToast();

  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/library/books');
      if (!res.ok) throw new Error('Failed to fetch books');
      const data = await res.json();
      setBooks(data.books || []);
      setBorrowedIds(data.borrowedIds || []);
    } catch (e: any) {
      showToast('Could not load library data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleAction = async (book: Book, action: 'borrow' | 'hold') => {
    if (actionState[book.id] === 'borrowed' || actionState[book.id] === 'held' || borrowedIds.includes(book.id)) return;
    
    setActionState(prev => ({ ...prev, [book.id]: 'loading' }));
    
    // Optimistic UI update
    const previousBooks = [...books];
    if (action === 'borrow') {
      setBooks(books.map(b => b.id === book.id ? { ...b, available: b.available - 1, borrowed: b.borrowed + 1 } : b));
    }

    try {
      const endpoint = action === 'borrow' ? '/api/library/borrow' : '/api/library/hold';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: book.id }),
      });
      const data = await res.json();
      
      if (!res.ok || data.error || !data.success) {
        throw new Error(data.error || data.reason || `${action} failed`);
      }
      
      setActionState(prev => ({ ...prev, [book.id]: action === 'borrow' ? 'borrowed' : 'held' }));
      if (action === 'borrow') {
        setBorrowedIds(prev => [...prev, book.id]);
        showToast(`📚 "${book.title}" borrowed successfully!`, 'success');
      } else {
        showToast(`📚 Hold placed for "${book.title}"!`, 'success');
      }
    } catch (e: any) {
      // Rollback optimistic update
      setBooks(previousBooks);
      setActionState(prev => ({ ...prev, [book.id]: 'idle' }));
      showToast(e.message, 'error');
    }
  };

  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>📖</span> Campus Library
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Browse, borrow, and place holds on books</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--glass)', borderRadius: 20, padding: '8px 16px', border: '1px solid var(--glass-border)', width: 300 }}>
          <HiOutlineMagnifyingGlass size={18} color="var(--text-muted)" style={{ marginRight: 8 }} />
          <input 
            type="text" 
            placeholder="Search title, author, or genre..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', width: '100%', fontSize: 14 }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 16 }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filteredBooks.map(book => {
            const isBorrowedByMe = borrowedIds.includes(book.id) || actionState[book.id] === 'borrowed';
            const state = actionState[book.id] || 'idle';
            
            return (
              <div key={book.id} className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-blue)', marginBottom: 4 }}>
                      {book.genre}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {book.title}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{book.author}</div>
                  </div>
                  <span style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, flexShrink: 0,
                    background: book.available > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: book.available > 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                  }}>
                    {book.available > 0 ? 'Available' : 'Out'}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                    <HiOutlineBookOpen size={14} />
                    {book.available} / {book.total_copies} available
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                    <HiOutlineMapPin size={14} />
                    {book.location}
                  </div>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {book.borrowed} currently borrowed
                  </div>
                  
                  {isBorrowedByMe ? (
                    <button disabled style={{
                      padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600,
                      background: 'rgba(34,197,94,0.15)', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 6
                    }}>
                      <HiOutlineCheckCircle size={14} /> Borrowed
                    </button>
                  ) : book.available > 0 ? (
                    <button 
                      onClick={() => handleAction(book, 'borrow')}
                      disabled={state === 'loading'}
                      style={{
                        padding: '6px 14px', borderRadius: 20, border: 'none', cursor: state === 'loading' ? 'default' : 'pointer', fontSize: 12, fontWeight: 600,
                        background: 'var(--accent-green)', color: 'white', display: 'flex', alignItems: 'center', gap: 6,
                        opacity: state === 'loading' ? 0.7 : 1
                      }}
                    >
                      {state === 'loading' ? '...' : 'Borrow'}
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleAction(book, 'hold')}
                      disabled={state === 'loading' || state === 'held'}
                      style={{
                        padding: '6px 14px', borderRadius: 20, border: 'none', cursor: (state === 'loading' || state === 'held') ? 'default' : 'pointer', fontSize: 12, fontWeight: 600,
                        background: state === 'held' ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: 6,
                        opacity: state === 'loading' ? 0.7 : 1
                      }}
                    >
                      {state === 'held' ? <><HiOutlineCheckCircle size={14} /> Held</> : <><HiOutlineBookmark size={14} /> Place Hold</>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
