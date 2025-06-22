```javascript
const SidebarEntity = ({ entity, onClick, isActive }) => {
  const isCorporateAI = entity.id === 'claude-copilot' || entity.id === 'chatgpt';
  
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-colors ${
        isActive 
          ? 'bg-blue-600 text-white' 
          : 'hover:bg-gray-700 text-gray-300'
      }`}
    >
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
          {entity.name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="font-medium">{entity.name}</div>
          {isCorporateAI && (
            <div className="text-xs text-gray-400 mt-0.5">
              {entity.model || 'Unknown Model'}
            </div>
          )}
          <div className="text-sm text-gray-400">{entity.status}</div>
        </div>
      </div>
    </button>
  );
};
```