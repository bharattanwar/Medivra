import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import api from '../services/api';

export interface Toast {
  id: string;
  title: string;
  message: string;
  type: string;
}

interface WebSocketContextType {
  client: Client | null;
  isConnected: boolean;
  messages: any[];
  presence: any;
  sendMessage: (destination: string, body: any) => void;
  notifications: any[];
  unreadCount: number;
  toasts: Toast[];
  removeToast: (id: string) => void;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  sosUpdate: any | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  // Reactive token state — drives the WebSocket connection lifecycle.
  // Initialised from localStorage so a page refresh reconnects immediately.
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  const [client, setClient] = useState<Client | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [presence, setPresence] = useState<any>({});
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sosUpdate, setSosUpdate] = useState<any | null>(null);
  const clientRef = useRef<Client | null>(null);

  // Listen for the custom 'auth:changed' event dispatched by Login / Logout.
  // This lets us react to auth transitions without a page refresh.
  useEffect(() => {
    const handleAuthChange = () => {
      setToken(localStorage.getItem('token'));
    };
    window.addEventListener('auth:changed', handleAuthChange);
    return () => window.removeEventListener('auth:changed', handleAuthChange);
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data.data || []);

      const unreadRes = await api.get('/notifications/unread-count');
      setUnreadCount(unreadRes.data.data || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const showToast = (title: string, message: string, type: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Re-run whenever `token` changes (login → connect, logout → disconnect).
  useEffect(() => {
    if (!token) {
      // No token — ensure any lingering client is torn down.
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
        setClient(null);
        setIsConnected(false);
      }
      return;
    }

    // Token present — load notifications and open the WebSocket.
    fetchNotifications();

    const stompClient = new Client({
      webSocketFactory: () => new SockJS(`${import.meta.env.VITE_API_URL}/ws`),
      reconnectDelay: 5000,
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      onConnect: () => {
        setIsConnected(true);
        // Subscribe to user specific messages
        stompClient.subscribe('/user/queue/messages', (msg) => {
          if (msg.body) {
            const message = JSON.parse(msg.body);
            setMessages((prev) => [...prev, message]);
          }
        });

        // Subscribe to notifications
        stompClient.subscribe('/user/queue/notifications', (msg) => {
          if (msg.body) {
            const notification = JSON.parse(msg.body);
            setNotifications((prev) => [notification, ...prev]);
            setUnreadCount((prev) => prev + 1);
            showToast(notification.title, notification.message, notification.type);
          }
        });

        // Subscribe to global presence
        stompClient.subscribe('/topic/presence', (msg) => {
          if (msg.body) {
            const update = JSON.parse(msg.body);
            setPresence((prev: any) => ({ ...prev, [update.userId]: update.status }));
          }
        });

        // Subscribe to SOS emergency updates
        stompClient.subscribe('/user/queue/sos', (msg) => {
          if (msg.body) {
            const update = JSON.parse(msg.body);
            setSosUpdate(update);
          }
        });
      },
      onStompError: (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
        console.error('Additional details: ' + frame.body);
      },
      onWebSocketClose: () => {
        setIsConnected(false);
      }
    });

    stompClient.activate();
    clientRef.current = stompClient;
    setClient(stompClient);

    return () => {
      stompClient.deactivate();
      clientRef.current = null;
      setIsConnected(false);
    };
  }, [token, fetchNotifications]);

  const sendMessage = (destination: string, body: any) => {
    if (clientRef.current && isConnected) {
      clientRef.current.publish({ destination, body: JSON.stringify(body) });
    } else {
      console.error("Cannot send message: WebSocket is not connected");
    }
  };

  return (
    <WebSocketContext.Provider value={{
      client,
      isConnected,
      messages,
      presence,
      sendMessage,
      notifications,
      unreadCount,
      toasts,
      removeToast,
      fetchNotifications,
      markAsRead,
      markAllAsRead,
      sosUpdate,
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};
