local cjson = require "cjson"

ngx.header.content_type = "application/json"
ngx.header["Access-Control-Allow-Origin"] = "*"

local scan_id = ngx.var.arg_scan_id or string.match(ngx.var.uri, "/api/scan/progress/(.+)$")

if not scan_id then
    ngx.status = 400
    ngx.say(cjson.encode({success = false, message = "No scan ID provided"}))
    return
end

local log_file = "/tmp/scan_" .. scan_id .. ".log"
local ssh_command = string.format(
    'HOME=/var/lib/nobody ssh -i /var/lib/nobody/.ssh/id_ed25519 -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@192.168.1.200 "if [ -f %s ]; then echo \\"LOG_EXISTS\\"; tail -30 %s; else echo \\"LOG_NOT_FOUND\\"; fi"',
    log_file, log_file
)

local handle = io.popen(ssh_command .. " 2>&1")
local output = ""
local complete = false
local progress = 10
local status = "running"

if handle then
    output = handle:read("*a") or ""
    handle:close()
    
    if output:match("LOG_NOT_FOUND") then
        progress = 100
        complete = true
        status = "completed"
        output = "Scan completed - results processed"
    elseif output:match("LOG_EXISTS") then
        output = output:gsub("LOG_EXISTS\n", "")
        
        -- Check for completion markers for different scan types
        if output:match("Found %d+ devices") or                          -- Network discovery completion
           output:match("net discovery complete") or                     -- Network discovery completion
           output:match("JSON output saved") or                          -- Network discovery completion
           output:match("SecScan complete") or                           -- Security scan completion
           output:match("Security summary:") or                          -- Security scan completion
           output:match("vulnerabilities.*found") or                     -- Security scan completion
           output:match("monitoring complete") or                        -- Traffic monitoring completion
           output:match("packets captured") or                           -- Traffic monitoring completion
           output:match("files saved to /opt/monitoring/traffic/") then  -- Traffic monitoring completion
            progress = 100
            complete = true
            status = "completed"
        elseif output:match("Starting security scan") and not output:match("SecScan complete") then
            progress = 20
        elseif output:match("starting network discovery") and not output:match("Found %d+ devices") then
            progress = 20
        elseif output:match("starting traffic monitoring") and not output:match("monitoring complete") then
            progress = 50
        elseif output:match("scanning") or output:match("running") or output:match("listening on") then
            progress = 60
        else
            progress = 30
        end
        
        -- Check for errors
        if output:match("error") or output:match("failed") or output:match("Error") then
            complete = true
            status = "error"
            progress = 0
        end
    end
end

ngx.say(cjson.encode({
    success = true,
    scan_id = scan_id,
    status = status,
    progress = progress,
    output = output,
    complete = complete
}))
