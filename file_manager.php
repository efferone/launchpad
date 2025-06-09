<?php
header('Content-Type: application/json');

// Configuration
$DOWNLOADS_PATH = '/mnt/media/Downloads/complete';
$MOVIES_PATH = '/mnt/media/Movies';
$SHOWS_PATH = '/mnt/media/Shows';

// SSH connection details for qBittorrent container
$QB_HOST = '192.168.1.95';
$QB_USER = 'root';
$SSH_KEY = '/var/www/.ssh/id_rsa';

function executeSSHCommand($command) {
    global $QB_HOST, $QB_USER, $SSH_KEY;
    
    $ssh_command = "ssh -i $SSH_KEY -o StrictHostKeyChecking=no $QB_USER@$QB_HOST " . escapeshellarg($command);
    
    exec($ssh_command, $output, $return_var);
    
    return [
        'success' => $return_var === 0,
        'output' => $output,
        'return_code' => $return_var
    ];
}

function listDownloadFiles() {
    global $DOWNLOADS_PATH;
    
    $escapedPath = escapeshellarg($DOWNLOADS_PATH);
    
    // Get video files
    $fileCommand = "find $escapedPath -maxdepth 1 -type f \( -name '*.mkv' -o -name '*.mp4' -o -name '*.avi' -o -name '*.mov' -o -name '*.wmv' -o -name '*.flv' -o -name '*.webm' \) -exec stat -c '%n|%s|file' {} \;";
    $fileResult = executeSSHCommand($fileCommand);
    
    // Get directories
    $dirCommand = "find $escapedPath -maxdepth 1 -type d ! -path $escapedPath -exec sh -c 'echo \"{}|$(du -sb \"{}\" | cut -f1)|dir\"' \;";
    $dirResult = executeSSHCommand($dirCommand);
    
    $items = [];
    
    // Process files
    if ($fileResult['success']) {
        foreach ($fileResult['output'] as $line) {
            if (trim($line)) {
                $parts = explode('|', $line);
                if (count($parts) === 3) {
                    $fullPath = $parts[0];
                    $size = intval($parts[1]);
                    $filename = basename($fullPath);
                    
                    $items[] = [
                        'name' => $filename,
                        'size' => formatFileSize($size),
                        'fullPath' => $fullPath,
                        'type' => 'file',
                        'isDirectory' => false
                    ];
                }
            }
        }
    }
    
    // Process directories
    if ($dirResult['success']) {
        foreach ($dirResult['output'] as $line) {
            if (trim($line)) {
                $parts = explode('|', $line);
                if (count($parts) === 3) {
                    $fullPath = $parts[0];
                    $size = intval($parts[1]);
                    $dirname = basename($fullPath);
                    
                    // Count video files in directory
                    $countCommand = "find " . escapeshellarg($fullPath) . " -type f \( -name '*.mkv' -o -name '*.mp4' -o -name '*.avi' -o -name '*.mov' -o -name '*.wmv' -o -name '*.flv' -o -name '*.webm' \) | wc -l";
                    $countResult = executeSSHCommand($countCommand);
                    $fileCount = $countResult['success'] ? intval($countResult['output'][0] ?? 0) : 0;
                    
                    $items[] = [
                        'name' => $dirname,
                        'size' => formatFileSize($size) . " ($fileCount files)",
                        'fullPath' => $fullPath,
                        'type' => 'directory',
                        'isDirectory' => true,
                        'fileCount' => $fileCount
                    ];
                }
            }
        }
    }
    
    // Sort: directories first, then files, alphabetically within each group
    usort($items, function($a, $b) {
        if ($a['isDirectory'] !== $b['isDirectory']) {
            return $b['isDirectory'] - $a['isDirectory']; // Directories first
        }
        return strcmp($a['name'], $b['name']);
    });
    
    return ['success' => true, 'files' => $items];
}

function browseDirectory($path, $type) {
    global $MOVIES_PATH, $SHOWS_PATH;
    
    // Validate path
    if ($type === 'movies' && strpos($path, $MOVIES_PATH) !== 0) {
        return ['success' => false, 'error' => 'Invalid movies path'];
    }
    if ($type === 'shows' && strpos($path, $SHOWS_PATH) !== 0) {
        return ['success' => false, 'error' => 'Invalid shows path'];
    }
    
    $escapedPath = escapeshellarg($path);
    
    // Get directories
    $dirCommand = "find $escapedPath -maxdepth 1 -type d ! -path $escapedPath -exec basename {} \; | sort";
    $dirResult = executeSSHCommand($dirCommand);
    
    $directories = [];
    if ($dirResult['success']) {
        foreach ($dirResult['output'] as $dirName) {
            $dirName = trim($dirName);
            if ($dirName && $dirName !== '.' && $dirName !== '..') {
                // Count files in this directory
                $dirPath = $path . '/' . $dirName;
                $countCommand = "find " . escapeshellarg($dirPath) . " -type f \( -name '*.mkv' -o -name '*.mp4' -o -name '*.avi' -o -name '*.mov' \) | wc -l";
                $countResult = executeSSHCommand($countCommand);
                $fileCount = $countResult['success'] ? intval($countResult['output'][0] ?? 0) : 0;
                
                $directories[] = [
                    'name' => $dirName,
                    'path' => $dirPath,
                    'fileCount' => $fileCount
                ];
            }
        }
    }
    
    // Get files
    $fileCommand = "find $escapedPath -maxdepth 1 -type f \( -name '*.mkv' -o -name '*.mp4' -o -name '*.avi' -o -name '*.mov' -o -name '*.wmv' -o -name '*.flv' -o -name '*.webm' \) -exec stat -c '%n|%s' {} \;";
    $fileResult = executeSSHCommand($fileCommand);
    
    $files = [];
    if ($fileResult['success']) {
        foreach ($fileResult['output'] as $line) {
            if (trim($line)) {
                $parts = explode('|', $line);
                if (count($parts) === 2) {
                    $fullPath = $parts[0];
                    $size = intval($parts[1]);
                    $filename = basename($fullPath);
                    
                    $files[] = [
                        'name' => $filename,
                        'size' => formatFileSize($size),
                        'fullPath' => $fullPath
                    ];
                }
            }
        }
    }
    
    return [
        'success' => true,
        'directories' => $directories,
        'files' => $files,
        'currentPath' => $path
    ];
}

function moveFileToPath($filename, $targetPath) {
    global $DOWNLOADS_PATH;
    
    // Sanitize inputs
    $safeFilename = escapeshellarg(basename($filename));
    $safeTargetPath = escapeshellarg($targetPath);
    $sourceFile = escapeshellarg("$DOWNLOADS_PATH/" . basename($filename));
    
    // Check if source exists (file or directory)
    $checkCommand = "test -e $sourceFile && echo 'exists'";
    $checkResult = executeSSHCommand($checkCommand);
    
    if (!$checkResult['success'] || !in_array('exists', $checkResult['output'])) {
        return ['success' => false, 'error' => 'Source file/directory not found'];
    }
    
    // Ensure target directory exists
    $mkdirCommand = "mkdir -p $safeTargetPath";
    $mkdirResult = executeSSHCommand($mkdirCommand);
    
    if (!$mkdirResult['success']) {
        return ['success' => false, 'error' => 'Failed to create target directory'];
    }
    
    // Move the file or directory
    $moveCommand = "mv $sourceFile $safeTargetPath/";
    $moveResult = executeSSHCommand($moveCommand);
    
    if ($moveResult['success']) {
        return ['success' => true, 'message' => "Item moved successfully"];
    } else {
        return ['success' => false, 'error' => 'Failed to move item'];
    }
}

function moveDirectoryToPath($dirname, $targetPath) {
    global $DOWNLOADS_PATH;
    
    // Sanitize inputs
    $safeDirname = escapeshellarg(basename($dirname));
    $safeTargetPath = escapeshellarg($targetPath);
    $sourceDir = escapeshellarg("$DOWNLOADS_PATH/" . basename($dirname));
    
    // Check if source directory exists
    $checkCommand = "test -d $sourceDir && echo 'exists'";
    $checkResult = executeSSHCommand($checkCommand);
    
    if (!$checkResult['success'] || !in_array('exists', $checkResult['output'])) {
        return ['success' => false, 'error' => 'Source directory not found'];
    }
    
    // Ensure target directory exists
    $mkdirCommand = "mkdir -p $safeTargetPath";
    $mkdirResult = executeSSHCommand($mkdirCommand);
    
    if (!$mkdirResult['success']) {
        return ['success' => false, 'error' => 'Failed to create target directory'];
    }
    
    // Move the directory
    $moveCommand = "mv $sourceDir $safeTargetPath/";
    $moveResult = executeSSHCommand($moveCommand);
    
    if ($moveResult['success']) {
        return ['success' => true, 'message' => "Directory moved successfully"];
    } else {
        return ['success' => false, 'error' => 'Failed to move directory'];
    }
}

function moveFile($filename, $destination) {
    global $MOVIES_PATH, $SHOWS_PATH;
    
    // Convert destination to path
    if ($destination === 'movies') {
        $targetPath = $MOVIES_PATH;
    } elseif ($destination === 'shows') {
        $targetPath = $SHOWS_PATH;
    } else {
        return ['success' => false, 'error' => 'Invalid destination'];
    }
    
    return moveFileToPath($filename, $targetPath);
}

function moveMultipleFilesToPath($files, $targetPath) {
    $results = [];
    $successCount = 0;
    $errors = [];
    
    foreach ($files as $filename) {
        $result = moveFileToPath($filename, $targetPath);
        if ($result['success']) {
            $successCount++;
        } else {
            $errors[] = "$filename: " . $result['error'];
        }
        $results[] = $result;
    }
    
    if ($successCount === count($files)) {
        return ['success' => true, 'moved' => $successCount];
    } elseif ($successCount > 0) {
        return ['success' => true, 'moved' => $successCount, 'errors' => $errors];
    } else {
        return ['success' => false, 'error' => 'Failed to move any items: ' . implode(', ', $errors)];
    }
}

function moveMultipleFiles($files, $destination) {
    global $MOVIES_PATH, $SHOWS_PATH;
    
    // Convert destination to path
    if ($destination === 'movies') {
        $targetPath = $MOVIES_PATH;
    } elseif ($destination === 'shows') {
        $targetPath = $SHOWS_PATH;
    } else {
        return ['success' => false, 'error' => 'Invalid destination'];
    }
    
    return moveMultipleFilesToPath($files, $targetPath);
}

function getFileCounts() {
    global $MOVIES_PATH, $SHOWS_PATH;
    
    // Count movies
    $moviesCommand = "find " . escapeshellarg($MOVIES_PATH) . " -type f \( -name '*.mkv' -o -name '*.mp4' -o -name '*.avi' -o -name '*.mov' \) | wc -l";
    $moviesResult = executeSSHCommand($moviesCommand);
    $moviesCount = $moviesResult['success'] ? intval($moviesResult['output'][0] ?? 0) : 0;
    
    // Count TV shows
    $showsCommand = "find " . escapeshellarg($SHOWS_PATH) . " -type f \( -name '*.mkv' -o -name '*.mp4' -o -name '*.avi' -o -name '*.mov' \) | wc -l";
    $showsResult = executeSSHCommand($showsCommand);
    $showsCount = $showsResult['success'] ? intval($showsResult['output'][0] ?? 0) : 0;
    
    return [
        'success' => true,
        'movies' => $moviesCount,
        'shows' => $showsCount
    ];
}

function formatFileSize($size) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    
    for ($i = 0; $size >= 1024 && $i < 4; $i++) {
        $size /= 1024;
    }
    
    return round($size, 2) . ' ' . $units[$i];
}

// Handle requests
try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $action = $_GET['action'] ?? '';
        
        switch ($action) {
            case 'list':
                echo json_encode(listDownloadFiles());
                break;
                
            case 'browse':
                $type = $_GET['type'] ?? '';
                $path = $_GET['path'] ?? '';
                
                if (empty($type) || empty($path)) {
                    echo json_encode(['success' => false, 'error' => 'Missing type or path']);
                } else {
                    echo json_encode(browseDirectory($path, $type));
                }
                break;
                
            case 'counts':
                echo json_encode(getFileCounts());
                break;
                
            default:
                echo json_encode(['success' => false, 'error' => 'Invalid action']);
        }
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input) {
            echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
            exit;
        }
        
        $action = $input['action'] ?? '';
        
        switch ($action) {
            case 'move':
                $filename = $input['filename'] ?? '';
                $destination = $input['destination'] ?? '';
                
                if (empty($filename) || empty($destination)) {
                    echo json_encode(['success' => false, 'error' => 'Missing filename or destination']);
                } else {
                    echo json_encode(moveFile($filename, $destination));
                }
                break;
                
            case 'move_to_path':
                $filename = $input['filename'] ?? '';
                $targetPath = $input['target_path'] ?? '';
                
                if (empty($filename) || empty($targetPath)) {
                    echo json_encode(['success' => false, 'error' => 'Missing filename or target path']);
                } else {
                    echo json_encode(moveFileToPath($filename, $targetPath));
                }
                break;
                
            case 'move_multiple':
                $files = $input['files'] ?? [];
                $destination = $input['destination'] ?? '';
                
                if (empty($files) || empty($destination)) {
                    echo json_encode(['success' => false, 'error' => 'Missing files or destination']);
                } else {
                    echo json_encode(moveMultipleFiles($files, $destination));
                }
                break;
                
            case 'move_multiple_to_path':
                $files = $input['files'] ?? [];
                $targetPath = $input['target_path'] ?? '';
                
                if (empty($files) || empty($targetPath)) {
                    echo json_encode(['success' => false, 'error' => 'Missing files or target path']);
                } else {
                    echo json_encode(moveMultipleFilesToPath($files, $targetPath));
                }
                break;
                
            default:
                echo json_encode(['success' => false, 'error' => 'Invalid action']);
        }
        
    } else {
        echo json_encode(['success' => false, 'error' => 'Invalid request method']);
    }
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
}
?>