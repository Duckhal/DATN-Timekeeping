#include "NetworkManager.h"

bool NetworkManager::connectStation(const DeviceConfig &config,
                                    uint32_t timeoutMs) {
  WiFi.mode(WIFI_STA);
  WiFi.begin(config.ssid.c_str(), config.password.c_str());

  const uint32_t startedAt = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - startedAt >= timeoutMs) {
      return false;
    }
    delay(250);
  }

  return true;
}

void NetworkManager::startConfigAp(const String &ssid) {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ssid.c_str());
}

String NetworkManager::apIpAddress() const {
  return WiFi.softAPIP().toString();
}

String NetworkManager::getMacAddress() const {
  return WiFi.macAddress();
}

int NetworkManager::getLastHttpStatusCode() const {
  return lastHttpStatusCode_;
}

String NetworkManager::buildBaseUrl(const DeviceConfig &config) const {
  return String("http://") + config.serverIp + ":" + String(config.serverPort) +
         "/api";
}

String NetworkManager::buildAuthorization(const String &apiKey) const {
  return String("Bearer ") + apiKey;
}

bool NetworkManager::postJson(const DeviceConfig &config, const String &apiKey,
                              const String &endpoint,
                              const String &payload) const {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Skip request because WiFi is disconnected.");
    lastHttpStatusCode_ = -1;
    return false;
  }

  HTTPClient http;
  const String url = buildBaseUrl(config) + endpoint;

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", buildAuthorization(apiKey));

  const int statusCode = http.POST(payload);
  const String responseBody = http.getString();
  lastHttpStatusCode_ = statusCode;

  Serial.printf("[HTTP] POST %s -> %d\n", url.c_str(), statusCode);
  Serial.printf("[HTTP] Response: %s\n", responseBody.c_str());

  http.end();

  return statusCode >= 200 && statusCode < 300;
}

bool NetworkManager::autoRegisterDevice(const DeviceConfig &config,
                                        const String &apiKey) const {
  const String mac = getMacAddress();
  const String payload = String("{\"mac_addr\":\"") + mac +
                         "\",\"name\":\"" + config.deviceName + "\"}";

  Serial.println("[Register] Sending device registration payload...");
  return postJson(config, apiKey, "/devices/register", payload);
}

bool NetworkManager::sendFingerprintCallback(const DeviceConfig &config,
                                             const String &apiKey,
                                             const String &fingerprintId) const {
  const String mac = getMacAddress();
  const String payload = String("{\"mac_addr\":\"") + mac +
                         "\",\"fingerprint_id\":\"" + fingerprintId +
                         "\"}";

  Serial.printf("[Fingerprint] Sending callback for fingerprint_id=%s\n",
                fingerprintId.c_str());
  return postJson(config, apiKey, "/devices/fingerprint-callback", payload);
}
