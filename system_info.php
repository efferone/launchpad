<?php
header('Content-Type: application/json');

// Define the path to the SSH key for www-data
$ssh_key = '/var/www/.ssh/id_rsa';

// Execute SSH command to run the script on the Proxmox host
$command = 'ssh -i ' . $ssh_key . ' -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no root@192.168.1.90 /usr/local/bin/system_stats.sh 2>&1';

// Log the command for debugging
error_log("Executing command: $command");

$result = shell_exec($command);

// Log the result for debugging
error_log("Command result: $result");

// Check if the command was successful and returned valid JSON
if ($result === null || json_decode($result) === null) {
    $error_message = $result ? $result : 'Unknown error';
    error_log("Error fetching system stats: $error_message");
    
    echo json_encode([
        'error' => true,
        'message' => 'Error fetching system stats: ' . $error_message,
        'uptime' => 'Connection error',
        'cpu_usage' => 0,
        'memory_usage' => 0,
        'memory_total' => 0,
        'client_ip' => $_SERVER['REMOTE_ADDR'],
        'connection_time' => 'Error',
        'timestamp' => date('Y-m-d H:i:s')
    ]);
} else {
    // Successfully executed the command, return the result
    echo $result;
}
?>