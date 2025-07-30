-- Simple stats.lua for now
local cjson = require "cjson"

ngx.header.content_type = "application/json"
ngx.header["Access-Control-Allow-Origin"] = "*"

-- Function to execute SSH command
local function ssh_command(command)
    local ssh_cmd = string.format(
        'HOME=/var/lib/nobody ssh -i /var/lib/nobody/.ssh/id_ed25519_proxmox -o StrictHostKeyChecking=no -o ConnectTimeout=8 root@192.168.1.90 "%s"',
        command
    )
    
    local handle = io.popen(ssh_cmd .. " 2>/dev/null")
    if not handle then
        return nil
    end
    
    local result = handle:read("*a")
    handle:close()
    
    if result then
        result = result:gsub("%s+$", "") -- trim trailing whitespace
        result = result:gsub("^%s+", "") -- trim leading whitespace
        if result == "" then
            return nil
        end
        return result
    end
    return nil
end

-- init default values
local uptime = "Unknown"
local cpu_usage = 0
local memory_usage = 0
local memory_total_gb = 0
local uk_time = "Unknown"

-- uptime
local uptime_raw = ssh_command("uptime")
if uptime_raw then
    local uptime_match = uptime_raw:match("up ([^,]+)")
    if uptime_match then
        uptime = uptime_match:gsub("^%s+", ""):gsub("%s+$", "")
    end
    
    -- load average as CPU indicator
    local load1 = uptime_raw:match("load average: ([%d%.]+)")
    if load1 then
        local load_val = tonumber(load1)
        if load_val then
            cpu_usage = math.min(100, math.floor(load_val * 25))
        end
    end
end

-- memory
local memory_raw = ssh_command("free -m | grep '^Mem:'")
if memory_raw then
    local total, used = memory_raw:match("Mem:%s+(%d+)%s+(%d+)")
    if total and used then
        total = tonumber(total)
        used = tonumber(used)
        if total and used and total > 0 then
            memory_usage = math.floor((used / total) * 100)
            memory_total_gb = math.floor((total / 1024) + 0.5)
        end
    end
end

-- current time
local time_raw = ssh_command("date '+%Y-%m-%d %H:%M:%S'")
if time_raw then
    uk_time = time_raw
end

-- build response
local response = {
    uptime = uptime,
    cpu_usage = cpu_usage,
    memory_usage = memory_usage,
    memory_total = memory_total_gb,
    server_time = uk_time,
    source = "proxmox_host_192.168.1.90"
}

-- Output JSON
local success, json_output = pcall(cjson.encode, response)
if success then
    ngx.say(json_output)
else
    ngx.status = 500
    ngx.say('{"error":"JSON encoding failed"}')
end
