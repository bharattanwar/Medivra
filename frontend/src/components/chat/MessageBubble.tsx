import React from 'react';

interface MessageBubbleProps {
  message: any;
  isOwn: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn }) => {
  return (
    <div className={`flex flex-col mb-4 ${isOwn ? 'items-end' : 'items-start'}`}>
      <div
        className={`px-4 py-2 rounded-2xl max-w-[70%] ${
          isOwn ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'
        }`}
      >
        {message.type === 'ATTACHMENT' && message.fileUrl && (
          <div className="mb-2">
            {message.fileUrl.match(/\.(jpeg|jpg|gif|png)$/) != null ? (
              <img src={`http://localhost:8080${message.fileUrl}`} alt="attachment" className="rounded-lg max-w-full h-auto" />
            ) : (
              <a href={`http://localhost:8080${message.fileUrl}`} target="_blank" rel="noopener noreferrer" className="underline text-blue-300">
                Download Attachment
              </a>
            )}
          </div>
        )}
        <p className="break-words">{message.content}</p>
      </div>
      <span className="text-xs text-gray-400 mt-1">
        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
};

export default MessageBubble;
