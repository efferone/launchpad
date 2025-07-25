// updated scripts.js for new OpenResty dashboard - please let this be the final version, it must be fixed now

// better device status check using OpenResty API
function checkDeviceStatus() {
    console.log('Checking device status via OpenResty API...');
    
    fetch('/api/devices')
        .then(response => response.json())
        .then(data => {
            if (data.devices) {
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
                console.log(`Updated ${data.total_devices} devices at ${data.server_time}`);
            }
        })
        .catch(error => {
            console.error('Error checking device status:', error);
        });
}

// faster system stats using OpenResty API
function updateStats() {
    console.log('Fetching system stats from OpenResty...');
    
    fetch('/api/stats')
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
            const uptimeEl = document.getElementById('dullbox-uptime');
            const cpuEl = document.getElementById('dullbox-cpu');
            const memoryEl = document.getElementById('dullbox-memory');
            const lastUpdatedEl = document.getElementById('last-updated');
            
            if (uptimeEl) uptimeEl.textContent = data.uptime || 'N/A';
            if (cpuEl) cpuEl.textContent = (data.cpu_usage || 0) + '%';
            if (memoryEl) {
                memoryEl.textContent = (data.memory_usage || 0) + '% of ' + (data.memory_total || 0) + 'GB';
            }
            if (lastUpdatedEl) lastUpdatedEl.textContent = new Date().toLocaleString();
        })
        .catch(error => {
            console.error('Error updating stats:', error);
            const uptimeEl = document.getElementById('dullbox-uptime');
            const cpuEl = document.getElementById('dullbox-cpu');
            const memoryEl = document.getElementById('dullbox-memory');
            
            if (uptimeEl) uptimeEl.textContent = 'Error: ' + error.message;
            if (cpuEl) cpuEl.textContent = 'Error';
            if (memoryEl) memoryEl.textContent = 'Error';
        });
}

function openWebSSH(host, username) {
    const hostUserMap = {
        '192.168.1.19': 'suzy',
        '192.168.1.21': 'fuzz',
        '192.168.1.53': 'snooze',
        '192.168.1.66': 'kong',
        '192.168.1.90': 'root',
        '192.168.1.91': 'root',
        '192.168.1.92': 'root',
        '192.168.1.93': 'root',
        '192.168.1.94': 'root',
        '192.168.1.105': 'debra',
        '192.168.1.101': 'root',
        '192.168.1.120': 'root'
    };
    
    username = username || hostUserMap[host] || 'root';
    
    // Update modal title with connection info
    const titleEl = document.getElementById('terminal-title');
    if (titleEl) {
        titleEl.textContent = `SSH Terminal - Connect to ${username}@${host}`;
    }
    
    // For webserver container (local), just open terminal
    const frameEl = document.getElementById('terminalFrame');
    if (frameEl) {
        frameEl.src = `http://192.168.1.91:2222`;
    }
    
    if (typeof $ !== 'undefined' && $('#terminalModal').length) {
        $('#terminalModal').modal('show');
        
        // Clean up when modal is closed
        $('#terminalModal').on('hidden.bs.modal', function () {
            if (frameEl) frameEl.src = '';
            const instructions = document.getElementById('connection-instructions');
            if (instructions) instructions.remove();
            $(this).off('hidden.bs.modal');
        });
    }
}

// Ollama Chat Functions
function openOllamaChat() {
    if (typeof $ !== 'undefined' && $('#ollamaModal').length) {
        $('#ollamaModal').modal('show');
        const chatInput = document.getElementById('chatInput');
        if (chatInput) chatInput.focus();
    }
}

function handleChatKeypress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    // Add user message
    addChatMessage(message, 'user');
    input.value = '';
    
    // Show thinking status
    showChatStatus(true);
    
    try {
        const modelSelector = document.getElementById('modelSelector');
        const model = modelSelector ? modelSelector.value : 'llama3.2:3b';
        
        // Try to use proxy first, fallback to direct connection
        let response;
        try {
            response = await fetch('/proxy/ollama/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model,
                    prompt: message,
                    stream: false
                })
            });
        } catch (proxyError) {
            console.log('Proxy failed, trying direct connection...');
            response = await fetch('http://192.168.1.19:11434/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model,
                    prompt: message,
                    stream: false
                })
            });
        }
        
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
        if (input) input.focus();
    }
}

function addChatMessage(message, sender, isError = false) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
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
    
    if (status) {
        status.style.display = show ? 'block' : 'none';
    }
    if (button) {
        button.disabled = show;
        button.innerHTML = show ? '<i class="fas fa-spinner fa-spin"></i>' : '<i class="fas fa-paper-plane"></i>';
    }
}

// Load available models on modal open
if (typeof $ !== 'undefined') {
    $(document).ready(function() {
        $('#ollamaModal').on('shown.bs.modal', function () {
            loadAvailableModels();
        });
    });
}

async function loadAvailableModels() {
    try {
        // Try proxy first, then direct
        let response;
        try {
            response = await fetch('/proxy/ollama/api/tags');
        } catch (proxyError) {
            response = await fetch('http://192.168.1.19:11434/api/tags');
        }
        
        if (response.ok) {
            const data = await response.json();
            const selector = document.getElementById('modelSelector');
            if (!selector) return;
            
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

// ===== MONITORING FUNCTIONS =====
let monitoringData = {};
let monitoringInterval;

// Initialize monitoring when page loads
function initMonitoring() {
    console.log('Initializing monitoring...');
    refreshMonitoringData();
    
    // Auto-refresh every 2 minutes
    monitoringInterval = setInterval(refreshMonitoringData, 120000);
}

function refreshMonitoringData() {
    // Use our OpenResty device data for basic monitoring
    fetch('/api/devices')
        .then(response => response.json())
        .then(deviceData => {
            const mockMonitoringData = {
                status: 'online',
                network_discovery: {
                    devices: deviceData.devices || [],
                    total_devices: deviceData.total_devices || 0
                },
                system_status: {
                    hostname: 'OpenResty-Dashboard',
                    uptime: 'Available via stats API',
                    ip: '192.168.1.98'
                }
            };
            monitoringData = mockMonitoringData;
            updateMonitoringCards(mockMonitoringData);
        })
        .catch(error => {
            console.error('Error fetching device data:', error);
            updateSentinelStatus(false);
        });
}

function updateMonitoringCards(data) {
    // Update sentinel status
    updateSentinelStatus(data.status === 'online');
    
    // Update network overview
    if (data.network_discovery && data.network_discovery.devices) {
        const devices = data.network_discovery.devices;
        const onlineDevices = devices.filter(device => device.status === 'online');
        
        const totalEl = document.getElementById('total-devices');
        const onlineEl = document.getElementById('online-devices');
        
        if (totalEl) totalEl.textContent = devices.length;
        if (onlineEl) onlineEl.textContent = onlineDevices.length;
    }
}

function updateSentinelStatus(online) {
    const statusDot = document.getElementById('sentinel-status-dot');
    const securityDot = document.getElementById('security-status-dot');
    
    if (statusDot) {
        statusDot.className = online ? 'status-indicator online' : 'status-indicator offline';
    }
    if (securityDot) {
        securityDot.className = online ? 'status-indicator online' : 'status-indicator offline';
    }
}

// Modal functions (with safety checks)
function openMonitoringModal() {
    const titleEl = document.getElementById('monitoring-modal-title');
    if (titleEl) {
        titleEl.textContent = 'Network Monitoring Overview';
        generateMonitoringModalContent('overview');
        if (typeof $ !== 'undefined') {
            $('#monitoringModal').modal('show');
        }
    }
}

function showDeviceList() {
    const titleEl = document.getElementById('monitoring-modal-title');
    if (titleEl) {
        titleEl.textContent = 'Network Devices';
        generateMonitoringModalContent('devices');
        if (typeof $ !== 'undefined') {
            $('#monitoringModal').modal('show');
        }
    }
}

function showSecurityDetails() {
    const titleEl = document.getElementById('monitoring-modal-title');
    if (titleEl) {
        titleEl.textContent = 'Security Status';
        generateMonitoringModalContent('security');
        if (typeof $ !== 'undefined') {
            $('#monitoringModal').modal('show');
        }
    }
}

function showBandwidthDetails() {
    const titleEl = document.getElementById('monitoring-modal-title');
    if (titleEl) {
        titleEl.textContent = 'Bandwidth & Traffic';
        generateMonitoringModalContent('bandwidth');
        if (typeof $ !== 'undefined') {
            $('#monitoringModal').modal('show');
        }
    }
}

function generateMonitoringModalContent(type) {
    const content = document.getElementById('monitoring-modal-content');
    if (!content) return;
    
    switch(type) {
        case 'overview':
            content.innerHTML = generateOverviewContent();
            break;
        case 'devices':
            content.innerHTML = generateDevicesContent();
            break;
        case 'security':
            content.innerHTML = generateSecurityContent();
            break;
        case 'bandwidth':
            content.innerHTML = generateBandwidthContent();
            break;
    }
}

function generateOverviewContent() {
    return `
        <div class="row">
            <div class="col-md-6">
                <div class="card" style="background: var(--card-color); border: 1px solid var(--title-color);">
                    <div class="card-header" style="background: rgba(255, 119, 0, 0.1); color: var(--title-color);">
                        <h5><i class="fas fa-server mr-2"></i>System Status</h5>
                    </div>
                    <div class="card-body" style="color: var(--text-color);">
                        <p><strong>Hostname:</strong> OpenResty-Dashboard</p>
                        <p><strong>IP Address:</strong> 192.168.1.98</p>
                        <p><strong>Platform:</strong> OpenResty + LXC</p>
                        <p><strong>Status:</strong> <span class="badge badge-success">Online</span></p>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card" style="background: var(--card-color); border: 1px solid var(--title-color);">
                    <div class="card-header" style="background: rgba(255, 119, 0, 0.1); color: var(--title-color);">
                        <h5><i class="fas fa-network-wired mr-2"></i>Network Summary</h5>
                    </div>
                    <div class="card-body" style="color: var(--text-color);">
                        <p><strong>Total Devices:</strong> ${monitoringData.network_discovery ? monitoringData.network_discovery.total_devices || 0 : 0}</p>
                        <p><strong>Network:</strong> 192.168.1.0/24</p>
                        <p><strong>Monitor:</strong> OpenResty Device API</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateDevicesContent() {
    const devices = monitoringData.network_discovery?.devices || [];
    
    if (devices.length === 0) {
        return '<div class="alert alert-warning">No devices found in monitoring data</div>';
    }
    
    return `
        <div class="table-responsive">
            <table class="table table-dark table-striped">
                <thead style="background: var(--title-color); color: #000;">
                    <tr>
                        <th>Status</th>
                        <th>IP Address</th>
                        <th>Device Name</th>
                        <th>Last Check</th>
                    </tr>
                </thead>
                <tbody>
                    ${devices.map(device => `
                        <tr>
                            <td><span class="badge badge-${device.status === 'online' ? 'success' : 'danger'}">${device.status}</span></td>
                            <td style="font-family: 'JetBrains Mono', monospace;">${device.ip}</td>
                            <td>${device.name || 'Unknown Device'}</td>
                            <td>${device.timestamp || 'Unknown'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function generateSecurityContent() {
    return `
        <div class="row">
            <div class="col-md-12">
                <div class="alert alert-info">
                    <strong>Note:</strong> Security monitoring requires LXC-Sentinel integration.
                </div>
            </div>
        </div>
    `;
}

function generateBandwidthContent() {
    return `
        <div class="row">
            <div class="col-md-12">
                <div class="alert alert-info">
                    <strong>Note:</strong> Bandwidth monitoring requires LXC-Sentinel integration or additional OpenResty modules.
                </div>
            </div>
        </div>
    `;
}

function refreshMonitoringModal() {
    refreshMonitoringData();
    setTimeout(() => {
        const currentTitle = document.getElementById('monitoring-modal-title');
        if (currentTitle) {
            if (currentTitle.textContent.includes('Overview')) generateMonitoringModalContent('overview');
            else if (currentTitle.textContent.includes('Devices')) generateMonitoringModalContent('devices');
            else if (currentTitle.textContent.includes('Security')) generateMonitoringModalContent('security');
            else if (currentTitle.textContent.includes('Bandwidth')) generateMonitoringModalContent('bandwidth');
        }
    }, 1000);
}

// cleaner initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing HomeTown Dashboard with OpenResty...');
    
    // Add connection status indicator
    const statusEl = document.createElement('div');
    statusEl.id = 'connection-status';
    statusEl.textContent = '🟢 OpenResty';
    statusEl.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 5px 10px;
        border-radius: 15px;
        font-size: 12px;
        z-index: 1000;
        background: rgba(46, 204, 113, 0.2);
        border: 1px solid #2ecc71;
        color: #2ecc71;
        font-family: 'JetBrains Mono', monospace;
    `;
    document.body.appendChild(statusEl);
    
    // Initialize monitoring
    initMonitoring();
    
    // Initialize stats and device checking
    updateStats();
    checkDeviceStatus();
    
    // Set up intervals
    setInterval(updateStats, 60000);  // Update every 60 seconds
    setInterval(checkDeviceStatus, 30000);  // Update every 30 seconds
    
    console.log('Dashboard initialization complete');
});

// Debug function
function debugDeviceStatus() {
    console.log('=== Device Status Debug ===');
    
    fetch('/api/devices')
        .then(response => response.json())
        .then(data => {
            console.log('API Response:', data);
            
            if (data.devices) {
                data.devices.forEach(device => {
                    console.log(`Checking device: ${device.name} (${device.ip}) - ${device.status}`);
                    
                    const indicators = document.querySelectorAll(`[data-device-ip="${device.ip}"]`);
                    console.log(`Found ${indicators.length} indicators for ${device.ip}`);
                    
                    indicators.forEach((indicator, index) => {
                        console.log(`Indicator ${index}:`, indicator);
                        console.log(`Classes:`, indicator.className);
                    });
                });
            }
        });
}