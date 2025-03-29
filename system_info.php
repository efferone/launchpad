<?php
header('Content-Type: application/json');

function get_uptime() {
    $uptime = shell_exec('uptime -p');
    return trim($uptime);
}

function get_cpu_usage() {
    $load = sys_getloadavg();
    $cores = intval(shell_exec('nproc'));
    return round(($load[0] / $cores) * 100, 1);
}

function get_memory_info() {
    $free = shell_exec('free -m');
    preg_match('/^Mem:\s+(\d+)\s+(\d+)/', $free, $matches);
    $total = round($matches[1] / 1024, 1);
    $used = round($matches[2] / 1024, 1);
    $usage = round(($used / $total) * 100, 1);
    return ['total' => $total, 'usage' => $usage];
}

function get_client_ip() {
    return $_SERVER['REMOTE_ADDR'];
}

function get_connection_time() {
    // This would ideally come from WireGuard logs
    // For now, we'll use a simple approximation
    $vpn_log = shell_exec('sudo wg show | grep latest');
    if (preg_match('/latest handshake: (.+)/', $vpn_log, $matches)) {
        return $matches[1];
    }
    return date('Y-m-d H:i:s');
}

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
?>