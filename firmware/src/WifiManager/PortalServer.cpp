#include "PortalServer.h"

PortalServer::PortalServer(uint16_t port) : server_(port) {}

void PortalServer::begin(const SaveHandler &saveHandler) {
  onSave_ = saveHandler;

  server_.on("/", HTTP_GET, [this]() { handleRoot(); });
  server_.on("/save", HTTP_POST, [this]() { handleSave(); });
  server_.onNotFound([this]() { handleRoot(); });

  server_.begin();
  isRunning_ = true;
}

void PortalServer::handleClient() {
  if (!isRunning_) {
    return;
  }

  server_.handleClient();
}

bool PortalServer::isRunning() const {
  return isRunning_;
}

void PortalServer::handleRoot() {
  server_.send(200, "text/html", renderHtml());
}

void PortalServer::handleSave() {
  if (!onSave_) {
    server_.send(500, "text/plain", "Save handler not available");
    return;
  }

  const String ssid = server_.arg("ssid");
  const String password = server_.arg("password");
  const String serverIp = server_.arg("server_ip");
  const String serverPortStr = server_.arg("server_port");
  const String deviceName = server_.arg("device_name");

  if (ssid.length() == 0 || password.length() == 0 || serverIp.length() == 0 ||
      serverPortStr.length() == 0 || deviceName.length() == 0) {
    server_.send(400, "text/plain",
                 "SSID, Password, Server IP, Server Port and Device Name are required.");
    return;
  }

  const int parsedPort = serverPortStr.toInt();
  if (parsedPort <= 0 || parsedPort > 65535) {
    server_.send(400, "text/plain", "Invalid server port.");
    return;
  }

  DeviceConfig config;
  config.ssid = ssid;
  config.password = password;
  config.serverIp = serverIp;
  config.serverPort = static_cast<uint16_t>(parsedPort);
  config.deviceName = deviceName;

  onSave_(config);

  server_.send(200, "text/html",
               "<html><body style='font-family:Arial;text-align:center;padding:24px;'>"
               "<h2>Saved successfully</h2><p>Device is restarting...</p></body></html>");
}

String PortalServer::renderHtml() const {
  String html;
  html.reserve(2500);

  html += "<!doctype html><html><head><meta charset='utf-8'>";
  html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>ESP32 Timekeeping Setup</title>";
  html += "<style>";
  html += "body{margin:0;padding:0;font-family:Arial,sans-serif;background:#0e0f13;color:#f7f8fa;}";
  html += ".wrap{max-width:460px;margin:24px auto;padding:18px;}";
  html += ".card{background:#171922;border:1px solid #2a2d3a;border-radius:14px;padding:18px;}";
  html += "h1{font-size:22px;margin:0 0 8px;}";
  html += "p{font-size:14px;color:#b9bece;margin:0 0 16px;}";
  html += "label{display:block;font-size:13px;margin:12px 0 6px;}";
  html += "input{width:100%;box-sizing:border-box;border:1px solid #363b4d;background:#0f1118;color:#fff;";
  html += "padding:11px 12px;border-radius:10px;font-size:14px;}";
  html += "button{margin-top:16px;width:100%;padding:12px;border:0;border-radius:10px;background:#1d9bf0;";
  html += "color:#fff;font-weight:700;font-size:15px;}";
  html += ".hint{font-size:12px;color:#8f95a9;margin-top:10px;}";
  html += "</style></head><body><div class='wrap'><div class='card'>";
  html += "<h1>ESP32 Timekeeping Setup</h1>";
  html += "<p>Configure WiFi and server connection.</p>";
  html += "<form method='POST' action='/save'>";
  html += "<label for='ssid'>WiFi SSID</label><input id='ssid' name='ssid' required>";
  html += "<label for='password'>WiFi Password</label><input id='password' name='password' type='password' required>";
  html += "<label for='server_ip'>Server IP</label><input id='server_ip' name='server_ip' placeholder='192.168.1.100' required>";
  html += "<label for='server_port'>Server Port</label><input id='server_port' name='server_port' value='3000' inputmode='numeric' required>";
  html += "<label for='device_name'>Device Name</label><input id='device_name' name='device_name' placeholder='Timekeeping-FrontDesk' required>";
  html += "<button type='submit'>Save & Restart</button>";
  html += "</form><div class='hint'>After submit, device restarts automatically.</div>";
  html += "</div></div></body></html>";

  return html;
}
