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

// ===== MONITORING FUNCTIONS =====
let monitoringData = {};
let monitoringInterval;

// Initialize monitoring when page loads
document.addEventListener('DOMContentLoaded', function() {
    initMonitoring();
});

function initMonitoring() {
    console.log('Initializing monitoring...');
    refreshMonitoringData();
    
    // Auto-refresh every 2 minutes
    monitoringInterval = setInterval(refreshMonitoringData, 120000);
}

function refreshMonitoringData() {
    fetch('/api/monitoring_dashboard.php')
        .then(response => response.json())
        .then(data => {
            monitoringData = data;
            updateMonitoringCards(data);
        })
        .catch(error => {
            console.error('Error fetching monitoring data:', error);
            updateSentinelStatus(false);
        });
}

function updateMonitoringCards(data) {
    // Update sentinel status
    updateSentinelStatus(data.status === 'online');
    
    // Update sentinel uptime
    if (data.system_status && data.system_status.uptime) {
        const uptimeMatch = data.system_status.uptime.match(/up\s+(.+?),/);
        document.getElementById('sentinel-uptime').textContent = uptimeMatch ? uptimeMatch[1] : 'Unknown';
    }
    
    // Update network overview
    if (data.network_discovery && data.network_discovery.devices) {
        const devices = data.network_discovery.devices;
        const onlineDevices = devices.filter(device => device.status === 'up');
        
        document.getElementById('total-devices').textContent = devices.length;
        document.getElementById('online-devices').textContent = onlineDevices.length;
    }
    
    // Update security status
    updateSecurityCard(data.security_summary);
    
    // Update bandwidth
    updateBandwidthCard(data.bandwidth_data);
}

function updateSentinelStatus(online) {
    const statusDot = document.getElementById('sentinel-status-dot');
    const securityDot = document.getElementById('security-status-dot');
    
    if (online) {
        statusDot.className = 'status-indicator online';
        securityDot.className = 'status-indicator online';
    } else {
        statusDot.className = 'status-indicator offline';
        securityDot.className = 'status-indicator offline';
    }
}

function updateSecurityCard(securityData) {
    const vulnCount = document.getElementById('vuln-count');
    const lastScan = document.getElementById('last-scan-short');
    
    if (securityData && !securityData.error) {
        vulnCount.textContent = securityData.vulnerability_count || '0';
        
        // Color code vulnerability count
        if (securityData.vulnerability_count > 10) {
            vulnCount.className = 'small-value error';
        } else if (securityData.vulnerability_count > 5) {
            vulnCount.className = 'small-value warning';
        } else {
            vulnCount.className = 'small-value';
        }
        
        // Format scan time
        if (securityData.scan_time) {
            const scanDate = new Date(securityData.scan_time);
            lastScan.textContent = scanDate.toLocaleDateString();
        } else {
            lastScan.textContent = 'Never';
        }
    } else {
        vulnCount.textContent = '-';
        lastScan.textContent = 'No data';
    }
}

function updateBandwidthCard(bandwidthData) {
    const totalRx = document.getElementById('total-rx-short');
    const totalTx = document.getElementById('total-tx-short');
    
    if (bandwidthData && bandwidthData.vnstat_data && bandwidthData.vnstat_data.interfaces) {
        const iface = bandwidthData.vnstat_data.interfaces[0];
        const totalTraffic = iface.traffic.total;
        
        totalRx.textContent = formatBytesShort(totalTraffic.rx);
        totalTx.textContent = formatBytesShort(totalTraffic.tx);
    } else {
        totalRx.textContent = '-';
        totalTx.textContent = '-';
    }
}

function formatBytesShort(bytes) {
    if (bytes === 0) return '0B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
}

// Modal functions
function openMonitoringModal() {
    document.getElementById('monitoring-modal-title').textContent = 'Network Monitoring Overview';
    generateMonitoringModalContent('overview');
    $('#monitoringModal').modal('show');
}

function showDeviceList() {
    document.getElementById('monitoring-modal-title').textContent = 'Network Devices';
    generateMonitoringModalContent('devices');
    $('#monitoringModal').modal('show');
}

function showSecurityDetails() {
    document.getElementById('monitoring-modal-title').textContent = 'Security Status';
    generateMonitoringModalContent('security');
    $('#monitoringModal').modal('show');
}

function showBandwidthDetails() {
    document.getElementById('monitoring-modal-title').textContent = 'Bandwidth & Traffic';
    generateMonitoringModalContent('bandwidth');
    $('#monitoringModal').modal('show');
}

function generateMonitoringModalContent(type) {
    const content = document.getElementById('monitoring-modal-content');
    
    if (!monitoringData || monitoringData.status !== 'online') {
        content.innerHTML = '<div class="alert alert-danger">LXC-Sentinel is offline or unreachable</div>';
        return;
    }
    
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
    const systemStatus = monitoringData.system_status || {};
    const networkData = monitoringData.network_discovery || {};
    
    return `
        <div class="row">
            <div class="col-md-6">
                <div class="card" style="background: var(--card-color); border: 1px solid var(--title-color);">
                    <div class="card-header" style="background: rgba(255, 119, 0, 0.1); color: var(--title-color);">
                        <h5><i class="fas fa-server mr-2"></i>System Status</h5>
                    </div>
                    <div class="card-body" style="color: var(--text-color);">
                        <p><strong>Hostname:</strong> ${systemStatus.hostname || 'Unknown'}</p>
                        <p><strong>IP Address:</strong> ${systemStatus.ip || 'Unknown'}</p>
                        <p><strong>Uptime:</strong> ${systemStatus.uptime || 'Unknown'}</p>
                        <p><strong>Services:</strong></p>
                        <ul>
                            ${systemStatus.services ? Object.entries(systemStatus.services).map(([service, status]) => 
                                `<li><span class="badge badge-${status === 'active' ? 'success' : 'danger'}">${service}</span> ${status}</li>`
                            ).join('') : '<li>No service data</li>'}
                        </ul>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card" style="background: var(--card-color); border: 1px solid var(--title-color);">
                    <div class="card-header" style="background: rgba(255, 119, 0, 0.1); color: var(--title-color);">
                        <h5><i class="fas fa-network-wired mr-2"></i>Network Summary</h5>
                    </div>
                    <div class="card-body" style="color: var(--text-color);">
                        <p><strong>Total Devices:</strong> ${networkData.total_devices || 0}</p>
                        <p><strong>Network:</strong> ${networkData.network || '192.168.1.0/24'}</p>
                        <p><strong>Last Scan:</strong> ${networkData.timestamp ? new Date(networkData.timestamp).toLocaleString() : 'Unknown'}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateDevicesContent() {
    const devices = monitoringData.network_discovery?.devices || [];
    
    if (devices.length === 0) {
        return '<div class="alert alert-warning">No devices found</div>';
    }
    
    return `
        <div class="table-responsive">
            <table class="table table-dark table-striped">
                <thead style="background: var(--title-color); color: #000;">
                    <tr>
                        <th>Status</th>
                        <th>IP Address</th>
                        <th>Hostname</th>
                        <th>Last Seen</th>
                    </tr>
                </thead>
                <tbody>
                    ${devices.map(device => `
                        <tr>
                            <td><span class="badge badge-${device.status === 'up' ? 'success' : 'danger'}">${device.status}</span></td>
                            <td style="font-family: 'JetBrains Mono', monospace;">${device.ip}</td>
                            <td>${device.hostname === 'Unknown' ? '<em>Unknown Device</em>' : device.hostname}</td>
                            <td>${new Date(device.last_seen).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function generateSecurityContent() {
    const securityData = monitoringData.security_summary || {};
    
    return `
        <div class="row">
            <div class="col-md-12">
                <div class="card" style="background: var(--card-color); border: 1px solid var(--title-color);">
                    <div class="card-header" style="background: rgba(255, 119, 0, 0.1); color: var(--title-color);">
                        <h5><i class="fas fa-shield-alt mr-2"></i>Security Scan Results</h5>
                    </div>
                    <div class="card-body" style="color: var(--text-color);">
                        ${securityData.error ? 
                            '<div class="alert alert-warning">No security scan data available</div>' :
                            `
                            <div class="row text-center">
                                <div class="col-md-3">
                                    <h3 class="text-${securityData.vulnerability_count > 10 ? 'danger' : securityData.vulnerability_count > 5 ? 'warning' : 'success'}">
                                        ${securityData.vulnerability_count || 0}
                                    </h3>
                                    <p>Potential Vulnerabilities</p>
                                </div>
                                <div class="col-md-3">
                                    <h3 class="text-${securityData.ssl_issues > 5 ? 'warning' : 'info'}">
                                        ${securityData.ssl_issues || 0}
                                    </h3>
                                    <p>SSL/TLS Issues</p>
                                </div>
                                <div class="col-md-3">
                                    <h3 class="text-info">
                                        ${securityData.hosts_scanned || 0}
                                    </h3>
                                    <p>Hosts Scanned</p>
                                </div>
                                <div class="col-md-3">
                                    <h3 class="text-muted">
                                        ${securityData.scan_time ? new Date(securityData.scan_time).toLocaleDateString() : 'Never'}
                                    </h3>
                                    <p>Last Scan</p>
                                </div>
                            </div>
                            <div class="alert alert-info mt-3">
                                <strong>Note:</strong> Many "vulnerabilities" are false positives from aggressive scanning. 
                                Review individual results for actual security concerns.
                            </div>
                            `
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateBandwidthContent() {
    const bandwidthData = monitoringData.bandwidth_data || {};
    const vnstatData = bandwidthData.vnstat_data || {};
    
    return `
        <div class="row">
            <div class="col-md-12">
                <div class="card" style="background: var(--card-color); border: 1px solid var(--title-color);">
                    <div class="card-header" style="background: rgba(255, 119, 0, 0.1); color: var(--title-color);">
                        <h5><i class="fas fa-chart-area mr-2"></i>Network Traffic Statistics</h5>
                    </div>
                    <div class="card-body" style="color: var(--text-color);">
                        ${vnstatData.interfaces ? `
                            <div class="row text-center">
                                <div class="col-md-6">
                                    <h4 class="text-success">${formatBytes(vnstatData.interfaces[0].traffic.total.rx)}</h4>
                                    <p>Total Received</p>
                                </div>
                                <div class="col-md-6">
                                    <h4 class="text-info">${formatBytes(vnstatData.interfaces[0].traffic.total.tx)}</h4>
                                    <p>Total Transmitted</p>
                                </div>
                            </div>
                            ${bandwidthData.current_stats?.connections ? `
                                <hr>
                                <h6>Current Connections</h6>
                                <ul>
                                    <li>TCP Connections: ${bandwidthData.current_stats.connections.tcp}</li>
                                    <li>UDP Connections: ${bandwidthData.current_stats.connections.udp}</li>
                                    <li>Listening Services: ${bandwidthData.current_stats.connections.listening}</li>
                                </ul>
                            ` : ''}
                        ` : '<div class="alert alert-warning">No bandwidth data available</div>'}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function refreshMonitoringModal() {
    refreshMonitoringData();
    setTimeout(() => {
        const currentTitle = document.getElementById('monitoring-modal-title').textContent;
        if (currentTitle.includes('Overview')) generateMonitoringModalContent('overview');
        else if (currentTitle.includes('Devices')) generateMonitoringModalContent('devices');
        else if (currentTitle.includes('Security')) generateMonitoringModalContent('security');
        else if (currentTitle.includes('Bandwidth')) generateMonitoringModalContent('bandwidth');
    }, 1000);
}

// Initialize functions
updateStats();
setInterval(updateStats, 60000);  // Update every 60 seconds

checkDeviceStatus();
setInterval(checkDeviceStatus, 30000);  // Update every 30 seconds