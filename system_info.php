<?php
header('Content-Type: application/json');

function get_uptime() {
    $uptime = shell_exec('uptime -p');
    return trim($uptime) ?: 'Unknown';
}

function get_cpu_usage() {
    $load = sys_getloadavg();
    $cores = intval(shell_exec('nproc'));
    
    if ($cores <= 0) {
        $cores = 1; // Prevent division by zero
    }
    
    return round(($load[0] / $cores) * 100, 1);
}

function get_memory_info() {
    $free = shell_exec('free -m');
    
    if (preg_match('/^Mem:\s+(\d+)\s+(\d+)/m', $free, $matches)) {
        $total = isset($matches[1]) ? round($matches[1] / 1024, 1) : 0;
        $used = isset($matches[2]) ? round($matches[2] / 1024, 1) : 0;
        
        // Prevent division by zero
        if ($total > 0) {
            $usage = round(($used / $total) * 100, 1);
        } else {
            $usage = 0;
            $total = 1; // Avoid showing 0 GB total memory
        }
        
        return ['total' => $total, 'usage' => $usage];
    }
    
    // Fallback if regex doesn't match
    return ['total' => 1, 'usage' => 0];
}

function get_client_ip() {
    return $_SERVER['REMOTE_ADDR'] ?: 'Unknown';
}

function get_connection_time() {
    // This would ideally come from WireGuard logs
    $vpn_log = shell_exec('sudo wg show 2>/dev/null | grep "latest handshake"');
    if ($vpn_log && preg_match('/latest handshake: (.+)/', $vpn_log, $matches)) {
        return $matches[1];
    }
    
    // Fallback: return current time
    return date('Y-m-d H:i:s');
}

try {
    $memory = get_memory_info();

    $data = [
        'uptime' => get_uptime(),
        'cpu_usage' => get_cpu_usage(),
        'memory_usage' => $memory['usage'],
        'memory_total' => $memory['total'],
        'client_ip' => get_client_ip(),
        'connection_time' => get_connection_time(),
        'timestamp' => date('Y-m-d H:i:s')
    ];

    echo json_encode($data);
} catch (Exception $e) {
    // Return error information
    echo json_encode([
        'error' => true,
        'message' => $e->getMessage(),
        'uptime' => 'Error',
        'cpu_usage' => 0,
        'memory_usage' => 0,
        'memory_total' => 0,
        'client_ip' => $_SERVER['REMOTE_ADDR'] ?: 'Unknown',
        'connection_time' => 'Error',
        'timestamp' => date('Y-m-d H:i:s')
    ]);
}
?>