local cjson = require "cjson"

ngx.header.content_type = "application/json"
ngx.header["Access-Control-Allow-Origin"] = "*"

if ngx.var.request_method == "OPTIONS" then
    ngx.exit(200)
end

if ngx.var.request_method ~= "POST" then
    ngx.status = 405
    ngx.say(cjson.encode({success = false, message = "Method not allowed"}))
    return
end

ngx.req.read_body()
local body = ngx.req.get_body_data()

if not body then
    ngx.status = 400
    ngx.say(cjson.encode({success = false, message = "No request body"}))
    return
end

local success, data = pcall(cjson.decode, body)
if not success then
    ngx.status = 400
    ngx.say(cjson.encode({success = false, message = "Invalid JSON"}))
    return
end

local scan_type = data.type or "quick"
local scan_id = tostring(data.timestamp or ngx.time())

-- Define scan commands based on type
local scan_commands = {
    quick = "/opt/network_discovery.sh",
    full = "/opt/network_discovery.sh && /opt/traffic_monitor.sh",
    security = "/opt/security_scan.sh"
}

local command = scan_commands[scan_type]
if not command then
    ngx.status = 400
    ngx.say(cjson.encode({success = false, message = "Invalid scan type"}))
    return
end

-- run scan command in background
local ssh_command = string.format(
    'HOME=/var/lib/nobody ssh -i /var/lib/nobody/.ssh/id_ed25519 -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@192.168.1.200 "echo \\"Starting scan %s\\" && nohup %s > /tmp/scan_%s.log 2>&1 & echo \\"Scan started with ID: %s\\""',
    scan_id, command, scan_id, scan_id
)

local handle = io.popen(ssh_command .. " 2>&1")
local result = ""
if handle then
    result = handle:read("*a") or ""
    handle:close()
end

-- Check if the command executed successfully
if result and result:match("Scan started") then
    ngx.say(cjson.encode({
        success = true,
        scan_id = scan_id,
        message = "Scan started successfully",
        type = scan_type,
        output = result
    }))
else
    ngx.status = 500
    ngx.say(cjson.encode({
        success = false,
        message = "Failed to start scan process",
        debug_output = result,
        command = ssh_command
    }))
end
