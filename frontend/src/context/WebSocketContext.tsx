import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

interface WebSocketContextType {
  client: Client | null;
  isConnected: boolean;
  messages: any[];
  presence: any;
  sendMessage: (destination: string, body: any) => void;
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
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const stompClient = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
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
    <WebSocketContext.Provider value={{ client, isConnected, messages, presence, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};
