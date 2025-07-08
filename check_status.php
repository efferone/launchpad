<?php
header('Content-Type: application/json');

// Get devices from request or use default list
$devices = isset($_GET['devices']) ? json_decode($_GET['devices'], true) : [
    ['name' => 'Main PC', 'ip' => '192.168.1.19'],
    ['name' => 'Laptop', 'ip' => '192.168.1.53'],
    ['name' => 'Pi Zero 2W', 'ip' => '192.168.1.66'],
    ['name' => 'Dullbox', 'ip' => '192.168.1.90'],
    ['name' => 'Webserver', 'ip' => '192.168.1.91'],
    ['name' => 'Gitea', 'ip' => '192.168.1.92'],
    ['name' => 'Syncthing', 'ip' => '192.168.1.93'],
    ['name' => 'Debian12', 'ip' => '192.168.1.105'],
    ['name' => 'Jellyfin', 'ip' => '192.168.1.94'],
    ['name' => 'GitLab', 'ip' => '192.168.1.101'],
    ['name' => 'GitLab Sim', 'ip' => '192.168.1.120']
];

$results = [];

foreach ($devices as $device) {
    // Execute ping command (1 packet only, 1 second timeout)
    $ip = escapeshellarg($device['ip']);
    $cmd = "ping -c 1 -W 1 $ip > /dev/null 2>&1";
    
    exec($cmd, $output, $return_var);
    
    // Add debug info for qBittorrent
    $debug_info = '';
    if ($device['name'] == 'qBittorrent') {
        $debug_info = " (return_var: $return_var, cmd: $cmd)";
    }
    
    $status = ($return_var === 0) ? 'online' : 'offline';
    
    $results[] = [
        'name' => $device['name'] . $debug_info,
        'ip' => $device['ip'],
        'status' => $status,
        'timestamp' => date('Y-m-d H:i:s')
    ];
}

echo json_encode(['devices' => $results]);
?>