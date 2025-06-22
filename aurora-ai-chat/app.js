// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Create console element if it doesn't exist
    if (!document.getElementById('console')) {
        const consoleElement = document.createElement('div');
        consoleElement.id = 'console';
        consoleElement.className = 'hidden';
        consoleElement.innerHTML = `
            <div class="console-header">
                <span>Console</span>
                <button onclick="toggleConsole()">×</button>
            </div>
            <div class="console-content">
                <div id="console-output"></div>
                <input type="text" id="console-input" placeholder="Enter command...">
            </div>
        `;
        document.body.appendChild(consoleElement);
    }
});

function toggleConsole() {
    const consoleElement = document.getElementById('console');
    const mainElement = document.querySelector('main');
    
    if (consoleElement) {
        consoleElement.classList.toggle('hidden');
        
        // Adjust main content area
        if (mainElement) {
            mainElement.classList.toggle('console-open');
        }
    }
}