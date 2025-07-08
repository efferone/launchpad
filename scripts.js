// Check device status via backend
function checkDeviceStatus() {
    // Basic devices
    const basicDevices = [
        { ip: '192.168.1.19', name: 'Main PC' },
        { ip: '192.168.1.53', name: 'Laptop' },
        { ip: '192.168.1.66', name: 'Pi Zero 2W' },
        { ip: '192.168.1.90', name: 'Dullbox' }
    ];
    
    // Core service containers
    const coreDevices = [
        { ip: '192.168.1.91', name: 'Webserver' },
        { ip: '192.168.1.92', name: 'Gitea' },
        { ip: '192.168.1.93', name: 'Syncthing' },
        { ip: '192.168.1.105', name: 'Debian12' },
        { ip: '192.168.1.101', name: 'GitLab' },
        { ip: '192.168.1.120', name: 'GitLab' }
    ];

    // Media server containers
    const mediaDevices = [
        { ip: '192.168.1.94', name: 'Jellyfin' }
    ];
    
    // Combine all devices for the status check
    const allDevices = [...basicDevices, ...coreDevices, ...mediaDevices];
    
    // Create a query string with all devices
    const devicesJson = encodeURIComponent(JSON.stringify(allDevices));
    
    fetch(`check_status.php?devices=${devicesJson}`)
        .then(response => response.json())
        .then(data => {
            data.devices.forEach(device => {
                // Find all indicators for this device by IP
                const indicators = document.querySelectorAll(`[data-device-ip="${device.ip}"]`);

                indicators.forEach(indicator => {
                    if (device.status === 'online') {
                        indicator.classList.add('online');
                        indicator.classList.remove('offline');
                        indicator.closest('.card, .container-card, .stats-container').style.opacity = 1;
                    } else {
                        indicator.classList.add('offline');
                        indicator.classList.remove('online');
                        indicator.closest('.card, .container-card, .stats-container').style.opacity = 0.7;
                    }
                });
            });
        })
        .catch(error => {
            console.error('Error checking device status:', error);
        });
}

// Update system info from backend
function updateStats() {
    console.log('Fetching system stats...');
    
    fetch('./system_info.php')
        .then(response => {
            console.log('Response status:', response.status);
            return response.json().catch(error => {
                console.error('Error parsing JSON:', error);
                throw new Error('Invalid JSON response');
            });
        })
        .then(data => {
            console.log('Received data:', data);
            
            // Check if there's an error in the data
            if (data.error) {
                console.error('Error in data:', data.message);
                throw new Error(data.message);
            }
            
            // Update the DOM elements
            document.getElementById('dullbox-uptime').textContent = data.uptime || 'N/A';
            document.getElementById('dullbox-cpu').textContent = data.cpu_usage + '%';
            document.getElementById('dullbox-memory').textContent = 
                data.memory_usage + '% of ' + data.memory_total + 'GB';
            
            // Update timestamp
            document.getElementById('last-updated').textContent = new Date().toLocaleString();
        })
        .catch(error => {
            console.error('Error updating stats:', error);
            document.getElementById('dullbox-uptime').textContent = 'Error: ' + error.message;
            document.getElementById('dullbox-cpu').textContent = 'Error';
            document.getElementById('dullbox-memory').textContent = 'Error';
        });
}

function openWebSSH(host, username) {
    const hostUserMap = {
        '192.168.1.19': 'suzy',    // Your PC
        '192.168.1.21': 'fuzz',    // Raspberry Pi 3  
        '192.168.1.53': 'snooze',  // Laptop
        '192.168.1.66': 'kong',    // Pi Zero 2W
        '192.168.1.90': 'root',    // Proxmox host
        '192.168.1.91': 'root',    // Webserver container
        '192.168.1.92': 'root',    // Gitea container
        '192.168.1.93': 'root',    // Syncthing container
        '192.168.1.94': 'root',    // Jellyfin container
        '192.168.1.105': 'debra',  // Debian12 VM
        '192.168.1.101': 'root',    // GitLab container
        '192.168.1.120': 'root'    // GitLab container
    };
    
    username = username || hostUserMap[host] || 'root';
    
    // Update modal title with connection info
    document.getElementById('terminal-title').textContent = `SSH Terminal - Connect to ${username}@${host}`;
    
    // For webserver container (local), just open terminal
    if (host === '192.168.1.91') {
        document.getElementById('terminalFrame').src = `http://192.168.1.91:2222`;
        $('#terminalModal').modal('show');
        showLocalInstructions();
    } else {
        // For remote hosts, show connection instructions
        document.getElementById('terminalFrame').src = `http://192.168.1.91:2222`;
        $('#terminalModal').modal('show');
        showConnectionInstructions(host, username);
    }
    
    // Clean up when modal is closed
    $('#terminalModal').on('hidden.bs.modal', function () {
        document.getElementById('terminalFrame').src = '';
        // Remove connection instructions
        const instructions = document.getElementById('connection-instructions');
        if (instructions) {
            instructions.remove();
        }
        $(this).off('hidden.bs.modal');
    });
}

// Ollama Chat Functions
function openOllamaChat() {
    $('#ollamaModal').modal('show');
    document.getElementById('chatInput').focus();
}

function handleChatKeypress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    addChatMessage(message, 'user');
    input.value = '';
    
    // Show thinking status
    showChatStatus(true);
    
    try {
        const response = await fetch('http://192.168.1.19:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: document.getElementById('modelSelector').value,
                prompt: message,
                stream: false
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        addChatMessage(data.response, 'ai');
        
    } catch (error) {
        console.error('Error:', error);
        addChatMessage('Sorry, I encountered an error. Please make sure Ollama is running on your PC.', 'ai', true);
    } finally {
        showChatStatus(false);
        input.focus();
    }
}

function addChatMessage(message, sender, isError = false) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    
    let className = 'chat-message ';
    let icon = '';
    let label = '';
    
    if (sender === 'user') {
        className += 'user-message';
        icon = '<i class="fas fa-user mr-2" style="color: var(--primary-color);"></i>';
        label = '<strong>You:</strong> ';
    } else {
        className += 'ai-message';
        icon = `<i class="fas fa-robot mr-2" style="color: ${isError ? '#e74c3c' : 'var(--title-color)'};"></i>`;
        label = '<strong>AI:</strong> ';
    }
    
    messageDiv.className = className;
    messageDiv.innerHTML = `
        <div class="message-content">
            ${icon}${label}${formatMessage(message)}
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatMessage(message) {
    // Basic markdown-style formatting
    return message
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

function showChatStatus(show) {
    const status = document.getElementById('chatStatus');
    const button = document.getElementById('sendButton');
    
    if (show) {
        status.style.display = 'block';
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    } else {
        status.style.display = 'none';
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }
}

// Load available models on modal open
$('#ollamaModal').on('shown.bs.modal', function () {
    loadAvailableModels();
});

async function loadAvailableModels() {
    try {
        const response = await fetch('http://192.168.1.19:11434/api/tags');
        if (response.ok) {
            const data = await response.json();
            const selector = document.getElementById('modelSelector');
            
            // Clear existing options
            selector.innerHTML = '';
            
            // Add available models
            data.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                selector.appendChild(option);
            });
            
            // Select the first model if available
            if (data.models.length > 0) {
                selector.value = data.models[0].name;
            }
        }
    } catch (error) {
        console.log('Could not load models, using default');
    }
}

// Initialize functions
updateStats();
setInterval(updateStats, 60000);  // Update every 60 seconds

checkDeviceStatus();
setInterval(checkDeviceStatus, 30000);  // Update every 30 seconds