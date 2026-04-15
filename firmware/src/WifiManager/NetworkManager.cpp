#include "NetworkManager.h"

#include <ArduinoJson.h>

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

NetworkManager::RemoteDeviceStatus NetworkManager::getLastRemoteStatus() const {
  return lastRemoteStatus_;
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

NetworkManager::RemoteDeviceStatus NetworkManager::parseRemoteStatus(
    const String &status) const {
  if (status == "ACTIVE") {
    return RemoteDeviceStatus::ACTIVE;
  }

  if (status == "INACTIVE") {
    return RemoteDeviceStatus::INACTIVE;
  }

  if (status == "MAINTENANCE") {
    return RemoteDeviceStatus::MAINTENANCE;
  }

  return RemoteDeviceStatus::UNKNOWN;
}

NetworkManager::RegisterHeartbeatResult NetworkManager::autoRegisterDevice(
    const DeviceConfig &config, const String &apiKey) const {
  RegisterHeartbeatResult result{
      false,
      0,
      RemoteDeviceStatus::UNKNOWN,
  };

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Skip register because WiFi is disconnected.");
    lastHttpStatusCode_ = -1;
    lastRemoteStatus_ = RemoteDeviceStatus::UNKNOWN;
    result.httpStatusCode = -1;
    return result;
  }

  const String mac = getMacAddress();
  const String payload = String("{\"mac_addr\":\"") + mac +
                         "\",\"name\":\"" + config.deviceName + "\"}";
  const String url = buildBaseUrl(config) + "/devices/register";

  Serial.println("[Register] Sending device registration payload...");

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", buildAuthorization(apiKey));

  const int statusCode = http.POST(payload);
  const String responseBody = http.getString();
  http.end();

  lastHttpStatusCode_ = statusCode;
  result.httpStatusCode = statusCode;

  Serial.printf("[HTTP] POST %s -> %d\n", url.c_str(), statusCode);
  Serial.printf("[HTTP] Response: %s\n", responseBody.c_str());

  if (statusCode < 200 || statusCode >= 300) {
    lastRemoteStatus_ = RemoteDeviceStatus::UNKNOWN;
    return result;
  }

  StaticJsonDocument<256> doc;
  const DeserializationError jsonError = deserializeJson(doc, responseBody);

  if (jsonError) {
    Serial.printf("[Register] Failed to parse heartbeat JSON: %s\n",
                  jsonError.c_str());
    lastRemoteStatus_ = RemoteDeviceStatus::UNKNOWN;
    return result;
  }

  const String remoteStatusText = doc["status"] | "";
  const RemoteDeviceStatus remoteStatus = parseRemoteStatus(remoteStatusText);

  if (remoteStatus == RemoteDeviceStatus::UNKNOWN) {
    Serial.println("[Register] Missing or invalid status field in heartbeat response.");
    lastRemoteStatus_ = RemoteDeviceStatus::UNKNOWN;
    return result;
  }

  lastRemoteStatus_ = remoteStatus;
  result.ok = true;
  result.remoteStatus = remoteStatus;
  return result;
}

bool NetworkManager::notifyFactoryReset(const DeviceConfig &config,
                                        const String &apiKey,
                                        uint32_t timeoutMs) const {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[FactoryReset] Skip notify because WiFi is disconnected.");
    lastHttpStatusCode_ = -1;
    return false;
  }

  const String url = buildBaseUrl(config) + "/devices/factory-reset";
  const String payload = String("{\"mac_addr\":\"") + getMacAddress() + "\"}";

  HTTPClient http;
  http.setTimeout(timeoutMs);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", buildAuthorization(apiKey));

  const int statusCode = http.POST(payload);
  const String responseBody = http.getString();
  http.end();

  lastHttpStatusCode_ = statusCode;
  Serial.printf("[HTTP] POST %s -> %d\n", url.c_str(), statusCode);
  Serial.printf("[HTTP] Response: %s\n", responseBody.c_str());

  return statusCode >= 200 && statusCode < 300;
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
