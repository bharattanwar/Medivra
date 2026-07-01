import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
  const [client, setClient] = useState<Client | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [presence, setPresence] = useState<any>({});
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const clientRef = useRef<Client | null>(null);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data.data || []);

      const unreadRes = await api.get('/notifications/unread-count');
      setUnreadCount(unreadRes.data.data || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Load initial notifications
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
      setIsConnected(false);
    };
  }, []);

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
      markAllAsRead
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};
