<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function getMonitoringData() {
    $data = [
        'status' => 'unknown',
        'last_update' => null,
        'network_discovery' => [],
        'security_summary' => [],
        'bandwidth_data' => [],
        'alerts' => [],
        'system_status' => []
    ];
    
    // Check if monitoring container is reachable
    $ping = shell_exec("ping -c 1 -W 2 192.168.1.200 2>/dev/null");
    $data['status'] = (strpos($ping, '1 received') !== false) ? 'online' : 'offline';
    
    if ($data['status'] === 'online') {
        // Get data from monitoring API
        $monitoring_api = 'http://192.168.1.200:5000';
        
        // Network discovery
        $discovery = @file_get_contents("$monitoring_api/api/network/discovery");
        if ($discovery) {
            $data['network_discovery'] = json_decode($discovery, true);
        }
        
        // Security summary
        $security = @file_get_contents("$monitoring_api/api/security/latest");
        if ($security) {
            $data['security_summary'] = json_decode($security, true);
        }
        
        // System status
        $status = @file_get_contents("$monitoring_api/api/monitoring/status");
        if ($status) {
            $data['system_status'] = json_decode($status, true);
        }
        
        // Bandwidth data
        $bandwidth = @file_get_contents("$monitoring_api/api/network/bandwidth");
        if ($bandwidth) {
            $data['bandwidth_data'] = json_decode($bandwidth, true);
        }
    }
    
    // Get latest alerts
    $alerts_file = '/var/www/html/data/latest_alerts.json';
    if (file_exists($alerts_file)) {
        $alerts = json_decode(file_get_contents($alerts_file), true);
        $data['alerts'] = array_slice($alerts ?: [], 0, 10); // Last 10 alerts
    }
    
    $data['last_update'] = date('c');
    
    return $data;
}

try {
    echo json_encode(getMonitoringData(), JSON_PRETTY_PRINT);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to get monitoring data: ' . $e->getMessage()]);
}
?>
