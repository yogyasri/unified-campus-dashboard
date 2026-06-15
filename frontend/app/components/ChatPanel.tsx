'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { HiOutlinePaperAirplane, HiOutlineSparkles, HiOutlineCheckCircle, HiOutlineBolt } from 'react-icons/hi2';
import ReactMarkdown from 'react-markdown';
import { useToast } from '../context/ToastContext';

interface ChatAction {
  type: 'rsvp' | 'hold' | 'favorite' | 'bookmark' | 'add_to_calendar' | 'set_dietary_alert';
  label: string;
  payload?: Record<string, unknown>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  actions?: ChatAction[];
  mode?: 'ai' | 'fallback';
}

const quickPrompts = [
  "Is Intro to Algorithms available?",
  "When does the tech fest workshop start?",
  "What's for lunch today?",
  "Where is the exam policy for CS101?",
];

const ACTION_ENDPOINTS: Record<string, string> = {
  rsvp: '/api/events/rsvp',
  hold: '/api/library/hold',
  favorite: '/api/cafeteria/favorite',
  bookmark: '/api/notifications/bookmark',
};

const ACTION_PAYLOAD_KEYS: Record<string, string> = {
  rsvp: 'eventId',
  hold: 'bookId',
  favorite: 'itemId',
  bookmark: 'announcementId',
};

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('campus_chat_history');
      if (saved) return JSON.parse(saved);
    }
    return [{
      id: '1',
      role: 'assistant',
      content: "Hi! 👋 I'm your **Campus Hub AI assistant**. I can help you find info about the library, cafeteria menus, upcoming events, your courses, and campus alerts.\n\nTry asking me anything!",
    }];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionState, setActionState] = useState<Record<string, 'idle' | 'loading' | 'done'>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const { showToast } = useToast();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 300 && newWidth < 800) {
        document.documentElement.style.setProperty('--chat-width', `${newWidth}px`);
      }
    };
    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = 'default';
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    if (messages.length > 0 && typeof window !== 'undefined') {
      localStorage.setItem('campus_chat_history', JSON.stringify(messages));
    }
  }, [messages]);

  // Listen for external queries (e.g. from AcademicsPanel "Ask AI" buttons)
  useEffect(() => {
    const handler = (e: Event) => {
      const query = (e as CustomEvent<string>).detail;
      if (query) handleSend(query);
    };
    window.addEventListener('campus-chat-query', handler);
    return () => window.removeEventListener('campus-chat-query', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build conversation history from messages state for multi-turn context
  const buildHistory = useCallback(() => {
    return messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10) // last 10 messages for context
      .map(m => ({ role: m.role, content: m.content }));
  }, [messages]);

  const handleSend = async (text?: string) => {
    const query = text || input;
    if (!query.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Send conversation history for multi-turn context
      const history = buildHistory();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer || 'Sorry, I couldn\'t process your request.',
        sources: data.sources,
        actions: data.actions,
        mode: data.mode || 'ai',
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, there was an error connecting to the server. Please make sure the MCP servers are running.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = useCallback(async (msgId: string, action: ChatAction) => {
    const key = `${msgId}-${action.type}`;
    if (actionState[key] === 'done') return;

    const endpoint = ACTION_ENDPOINTS[action.type];
    
    // Client-only actions or missing payload fallback to chat
    if (!endpoint || (action.type === 'rsvp' && !action.payload?.eventId)) {
      if (action.type === 'add_to_calendar') {
        handleSend("Please generate an ICS calendar link or format for this event so I can add it to my calendar.");
      } else if (action.type === 'rsvp' && !action.payload?.eventId) {
        handleSend("I would like to RSVP to the event we're talking about.");
      }
      setActionState((prev) => ({ ...prev, [key]: 'done' }));
      return;
    }

    // Optimistic
    setActionState((prev) => ({ ...prev, [key]: 'loading' }));

    const payloadKey = ACTION_PAYLOAD_KEYS[action.type];
    const body: Record<string, unknown> = { ...action.payload };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error || data.success === false) {
        throw new Error(data.error || data.reason || 'Action failed');
      }
      setActionState((prev) => ({ ...prev, [key]: 'done' }));
      showToast(data.message || `${action.label} — done!`, 'success');
    } catch (err: any) {
      setActionState((prev) => ({ ...prev, [key]: 'idle' }));
      showToast(`Network timeout. Could not complete "${action.label}".`, 'error');
    }
  }, [actionState, showToast]);

  const sourceColors: Record<string, string> = {
    library: 'badge-purple',
    cafeteria: 'badge-amber',
    events: 'badge-blue',
    academics: 'badge-teal',
    notifications: 'badge-red',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      borderLeft: '1px solid var(--glass-border)',
      background: 'var(--bg-secondary)',
      position: 'relative'
    }}>
      {/* Resizer */}
      <div
        onMouseDown={() => {
          isResizing.current = true;
          document.body.style.cursor = 'col-resize';
        }}
        style={{
          position: 'absolute',
          left: -2,
          top: 0,
          bottom: 0,
          width: 5,
          cursor: 'col-resize',
          zIndex: 10,
          backgroundColor: 'transparent'
        }}
      />
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--glass-border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <HiOutlineSparkles size={16} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>AI Assistant</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <div className="live-indicator" style={{ width: 6, height: 6 }} />
            Ready
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: 12,
          }}>
            <div style={{ maxWidth: '100%' }}>
              <div className={`chat-bubble ${msg.role}`}>
                {msg.role === 'assistant' ? (
                  <div className="chat-markdown">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <span>{msg.content}</span>
                )}
                {/* Source tags + mode indicator */}
                {msg.role === 'assistant' && (msg.sources?.length || msg.mode) && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {msg.sources?.map((s) => (
                      <span key={s} className={`badge ${sourceColors[s] || 'badge-blue'}`}>{s}</span>
                    ))}
                    {msg.mode && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: msg.mode === 'ai' ? 'rgba(139,92,246,0.12)' : 'rgba(245,158,11,0.12)',
                        color: msg.mode === 'ai' ? 'var(--accent-purple)' : 'var(--accent-amber)',
                      }}>
                        {msg.mode === 'ai'
                          ? <><HiOutlineSparkles size={10} /> AI</>
                          : <><HiOutlineBolt size={10} /> Quick Answer</>
                        }
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div className="chat-bubble assistant" style={{ display: 'flex', gap: 6, padding: '14px 18px' }}>
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      {messages.length <= 2 && !isLoading && (
        <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="btn-ghost"
              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20 }}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            className="input-field"
            placeholder="Ask about campus..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
            style={{ borderRadius: 20, paddingLeft: 16 }}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="btn-primary"
            style={{ borderRadius: 20, padding: '10px 14px', flexShrink: 0 }}
          >
            <HiOutlinePaperAirplane size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
