import React from 'react';

const ChatMessage = ({ message, entity }) => {
  const isCorporateAI = entity && (entity.id === 'claude-copilot' || entity.id === 'chatgpt');
  
  return (
    <div className={`flex ${message.sender === 'You' ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[70%] ${message.sender === 'You' ? 'order-2' : 'order-1'}`}>
        <div className="flex items-center space-x-2 mb-1">
          {message.sender !== 'You' && (
            <span className="text-sm font-medium text-gray-300">
              {message.sender}
              {isCorporateAI && entity && (
                <span className="text-xs text-gray-500 ml-2">
                  ({entity.model})
                </span>
              )}
            </span>
          )}
        </div>
        <div className={`rounded-lg px-4 py-2 ${
          message.sender === 'You' 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-700 text-gray-100'
        }`}>
          {message.content}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;