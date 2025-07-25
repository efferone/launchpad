<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || !isset($data['message']) || !isset($data['severity'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid data']);
    exit;
}

// Log monitoring alerts
$log_file = '/var/www/html/logs/monitoring_alerts.log';
$log_dir = dirname($log_file);

if (!is_dir($log_dir)) {
    mkdir($log_dir, 0755, true);
    chown($log_dir, 'www-data');
    chgrp($log_dir, 'www-data');
}

$timestamp = $data['timestamp'] ?? date('Y-m-d H:i:s');
$source = $data['source'] ?? 'lxc-sentinel';
$log_entry = "$timestamp [$source] [{$data['severity']}] {$data['message']}\n";
file_put_contents($log_file, $log_entry, FILE_APPEND | LOCK_EX);

// Store latest alerts in JSON for dashboard
$alerts_json = '/var/www/html/data/latest_alerts.json';
$alerts_dir = dirname($alerts_json);

if (!is_dir($alerts_dir)) {
    mkdir($alerts_dir, 0755, true);
    chown($alerts_dir, 'www-data');
    chgrp($alerts_dir, 'www-data');
}

// Read existing alerts
$existing_alerts = [];
if (file_exists($alerts_json)) {
    $existing_alerts = json_decode(file_get_contents($alerts_json), true) ?: [];
}

// Add new alert
$new_alert = [
    'timestamp' => $timestamp,
    'severity' => $data['severity'],
    'message' => $data['message'],
    'source' => $source,
    'id' => uniqid()
];

array_unshift($existing_alerts, $new_alert);

// Keep only last 50 alerts
$existing_alerts = array_slice($existing_alerts, 0, 50);

file_put_contents($alerts_json, json_encode($existing_alerts, JSON_PRETTY_PRINT));

echo json_encode(['status' => 'success', 'message' => 'Alert logged']);
?>
