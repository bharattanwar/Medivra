import React, { useEffect, useRef } from 'react';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import { useWebSocket } from '../../context/WebSocketContext';

interface ChatWindowProps {
  conversationId: string;
  otherPartyName: string;
  otherPartyId: string;
  onClose: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ conversationId, otherPartyName, otherPartyId, onClose }) => {
  const { messages, presence, isConnected } = useWebSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // In a real app we'd get our own userId from auth context
  const currentUserId = localStorage.getItem('userId') || ''; 

  const conversationMessages = messages.filter(m => m.conversationId === conversationId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages]);

  const isOnline = presence[otherPartyId] === 'ONLINE';

  return (
    <div className="fixed bottom-0 right-10 w-96 h-[500px] bg-white rounded-t-lg shadow-2xl flex flex-col z-50 border border-gray-200">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 bg-blue-400 rounded-full flex items-center justify-center text-lg font-bold">
              {otherPartyName.charAt(0).toUpperCase()}
            </div>
            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          </div>
          <div>
            <h3 className="font-semibold text-lg">{otherPartyName}</h3>
            <span className="text-xs text-blue-100">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        <button onClick={onClose} className="text-white hover:text-gray-200 focus:outline-none">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
        {!isConnected && (
          <div className="text-center text-xs text-orange-500 mb-4 bg-orange-50 p-2 rounded">
            Reconnecting to chat...
          </div>
        )}
        {conversationMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            Send a message to start the consultation.
          </div>
        ) : (
          conversationMessages.map((msg, index) => (
            <MessageBubble 
              key={index} 
              message={msg} 
              isOwn={msg.senderId === currentUserId} 
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput conversationId={conversationId} />
    </div>
  );
};

export default ChatWindow;
