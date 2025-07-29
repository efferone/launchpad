local cjson = require "cjson"

-- Function to format date in UK format
local function format_uk_date()
    return os.date("%d/%m/%Y %H:%M:%S")
end

-- Function to check single device
local function check_device(ip, name)
    local cmd = "ping -c 1 -W 1 " .. ip .. " > /dev/null 2>&1"
    local handle = io.popen(cmd)
    local result = handle:close()
    local status = result and "online" or "offline"
    
    return {
        name = name,
        ip = ip,
        status = status,
        timestamp = format_uk_date()
    }
end

-- Function to check all devices
local function check_all_devices()
    local devices = {
        {ip = "192.168.1.19", name = "Main PC"},
        {ip = "192.168.1.53", name = "Laptop"},
        {ip = "192.168.1.66", name = "Pi Zero 2W"},
        {ip = "192.168.1.90", name = "Dullbox"},
        {ip = "192.168.1.91", name = "Webserver"},
        {ip = "192.168.1.92", name = "Gitea"},
        {ip = "192.168.1.93", name = "Syncthing"},
        {ip = "192.168.1.94", name = "Jellyfin"},
        {ip = "192.168.1.105", name = "Debian12"},
        {ip = "192.168.1.101", name = "GitLab"},
        {ip = "192.168.1.120", name = "GitLab Sim"}
    }
    
    local results = {}
    for _, device in ipairs(devices) do
        table.insert(results, check_device(device.ip, device.name))
    end
    
    return {
        devices = results,
        server_time = format_uk_date(),
        timezone = "Europe/London",
        total_devices = #results
    }
end

-- Main execution
local device_data = check_all_devices()
ngx.header.content_type = "application/json"
ngx.say(cjson.encode(device_data))
