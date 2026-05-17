import React, { useState } from 'react';
import { useWebSocket } from '../../context/WebSocketContext';

interface ChatInputProps {
  conversationId: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ conversationId }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const { sendMessage } = useWebSocket();

  const handleSend = async () => {
    if (!text.trim() && !file) return;

    let fileUrl = null;

    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:8080/api/chat/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        if (res.ok) {
          fileUrl = await res.text();
        }
      } catch (err) {
        console.error('Failed to upload file', err);
        return;
      }
    }

    sendMessage('/app/chat.sendMessage', {
      conversationId,
      content: text,
      type: file ? 'ATTACHMENT' : 'CHAT',
      fileUrl
    });

    setText('');
    setFile(null);
  };

  return (
    <div className="flex items-center p-4 border-t bg-white">
      <input
        type="file"
        id="file-upload"
        className="hidden"
        onChange={(e) => e.target.files && setFile(e.target.files[0])}
      />
      <label htmlFor="file-upload" className="cursor-pointer text-blue-500 mr-2">
        📎
      </label>
      {file && <span className="text-xs mr-2 truncate w-20">{file.name}</span>}
      <input
        type="text"
        className="flex-1 p-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Type a message..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
      />
      <button
        onClick={handleSend}
        className="ml-2 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700"
      >
        Send
      </button>
    </div>
  );
};

export default ChatInput;
