<?php
header('Content-Type: application/json');

// Get devices from request or use default list
$devices = isset($_GET['devices']) ? json_decode($_GET['devices'], true) : [
    ['name' => 'PC', 'ip' => '192.168.1.10'],
    ['name' => 'Laptop', 'ip' => '192.168.1.11'],
    ['name' => 'NAS', 'ip' => '192.168.1.12'],
    ['name' => 'Raspberry Pi', 'ip' => '192.168.1.21']
];

$results = [];

foreach ($devices as $device) {
    // Execute ping command (1 packet only, 1 second timeout)
    $ip = escapeshellarg($device['ip']);
    // For Linux
    $cmd = "ping -c 1 -W 1 $ip > /dev/null 2>&1";
    // For Windows, use: $cmd = "ping -n 1 -w 1000 $ip > NUL";
    
    exec($cmd, $output, $return_var);
    
    // $return_var will be 0 if the ping was successful
    $status = ($return_var === 0) ? 'online' : 'offline';
    
    $results[] = [
        'name' => $device['name'],
        'ip' => $device['ip'],
        'status' => $status,
        'timestamp' => date('Y-m-d H:i:s')
    ];
}

echo json_encode(['devices' => $results]);
?>