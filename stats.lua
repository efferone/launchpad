local cjson = require "cjson"

-- Function to format date in UK format
local function format_uk_date()
    return os.date("%d/%m/%Y %H:%M:%S")
end

-- Function to get basic system stats
local function get_system_stats()
    -- Get uptime
    local uptime_handle = io.popen("uptime")
    local uptime = uptime_handle and uptime_handle:read("*line") or "Unknown"
    if uptime_handle then uptime_handle:close() end
    
    -- Get CPU usage 
    local cpu_handle = io.popen("grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$3+$4+$5)} END {printf \"%.1f\", usage}'")
    local cpu_usage = cpu_handle and tonumber(cpu_handle:read("*line")) or 0
    if cpu_handle then cpu_handle:close() end
    
    -- Get memory info
    local mem_handle = io.popen("free -m | awk 'NR==2{printf \"%.1f %.1f\", $3*100/$2, $2/1024}'")
    local mem_data = mem_handle and mem_handle:read("*line") or "0 0"
    if mem_handle then mem_handle:close() end
    
    local mem_parts = {}
    for part in string.gmatch(mem_data, "%S+") do
        table.insert(mem_parts, part)
    end
    
    return {
        uptime = uptime,
        cpu_usage = cpu_usage or 0,
        memory_usage = tonumber(mem_parts[1]) or 0,
        memory_total = tonumber(mem_parts[2]) or 0,
        client_ip = ngx.var.remote_addr,
        timestamp = format_uk_date(),
        server = "OpenResty-HomeTown",
        container = "lxc-openresty"
    }
end

-- Get fresh data
local success, stats_data = pcall(get_system_stats)

if not success then
    ngx.status = 500
    ngx.header.content_type = "application/json"
    ngx.say(cjson.encode({
        error = true,
        message = "Failed to get system stats: " .. tostring(stats_data),
        timestamp = format_uk_date()
    }))
    return
end

local json_data = cjson.encode(stats_data)

ngx.header.content_type = "application/json"
ngx.say(json_data)
