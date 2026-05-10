#include "services/NetworkService.h"

#include <ArduinoJson.h>

#include "Config/Config.h"

namespace tk::services {
bool NetworkService::connectStation(const models::DeviceConfig& config,
                                    uint32_t timeoutMs) {
  return wifi_.connectStation(config.ssid, config.password, timeoutMs);
}

void NetworkService::startConfigAp(const String& ssid) {
  wifi_.startAccessPoint(ssid);
}

wl_status_t NetworkService::wifiStatus() const {
  return wifi_.status();
}

String NetworkService::localIpAddress() const {
  return wifi_.localIpAddress();
}

String NetworkService::apIpAddress() const {
  return wifi_.apIpAddress();
}

String NetworkService::macAddress() const {
  return wifi_.macAddress();
}

int NetworkService::getLastHttpStatusCode() const {
  return lastHttpStatusCode_;
}

models::RemoteDeviceStatus NetworkService::getLastRemoteStatus() const {
  return lastRemoteStatus_;
}

models::RegisterHeartbeatResult NetworkService::autoRegisterDevice(
    const models::DeviceConfig& config,
    const String& apiKey) {
  models::RegisterHeartbeatResult result{
      false,
      0,
      models::RemoteDeviceStatus::UNKNOWN,
  };

  if (wifiStatus() != WL_CONNECTED) {
    Serial.println("[HTTP] Skip register because WiFi is disconnected.");
    lastHttpStatusCode_ = -1;
    lastRemoteStatus_ = models::RemoteDeviceStatus::UNKNOWN;
    result.httpStatusCode = -1;
    return result;
  }

  const String payload = String("{\"mac_addr\":\"") + macAddress() +
                         "\",\"name\":\"" + config.deviceName + "\"}";
  const String url = buildBaseUrl(config) + config::network::kRegisterEndpoint;

  Serial.println("[Register] Sending device registration payload...");

  const models::HttpResponse response =
      http_.postJson(url, payload, buildAuthorization(apiKey));

  lastHttpStatusCode_ = response.statusCode;
  result.httpStatusCode = response.statusCode;

  Serial.printf("[HTTP] POST %s -> %d\n", url.c_str(), response.statusCode);
  Serial.printf("[HTTP] Response: %s\n", response.body.c_str());

  if (!response.ok) {
    lastRemoteStatus_ = models::RemoteDeviceStatus::UNKNOWN;
    return result;
  }

  StaticJsonDocument<256> doc;
  const DeserializationError jsonError = deserializeJson(doc, response.body);
  if (jsonError) {
    Serial.printf("[Register] Failed to parse heartbeat JSON: %s\n", jsonError.c_str());
    lastRemoteStatus_ = models::RemoteDeviceStatus::UNKNOWN;
    return result;
  }

  const String remoteStatusText = doc["status"] | "";
  const models::RemoteDeviceStatus remoteStatus = parseRemoteStatus(remoteStatusText);
  if (remoteStatus == models::RemoteDeviceStatus::UNKNOWN) {
    Serial.println("[Register] Missing or invalid status field in heartbeat response.");
    lastRemoteStatus_ = models::RemoteDeviceStatus::UNKNOWN;
    return result;
  }

  lastRemoteStatus_ = remoteStatus;
  result.ok = true;
  result.remoteStatus = remoteStatus;
  return result;
}

bool NetworkService::notifyFactoryReset(const models::DeviceConfig& config,
                                        const String& apiKey,
                                        uint32_t timeoutMs) {
  if (wifiStatus() != WL_CONNECTED) {
    Serial.println("[FactoryReset] Skip notify because WiFi is disconnected.");
    lastHttpStatusCode_ = -1;
    return false;
  }

  const String url = buildBaseUrl(config) + config::network::kFactoryResetEndpoint;
  const String payload = String("{\"mac_addr\":\"") + macAddress() + "\"}";

  const models::HttpResponse response =
      http_.postJson(url, payload, buildAuthorization(apiKey), timeoutMs);

  lastHttpStatusCode_ = response.statusCode;
  Serial.printf("[HTTP] POST %s -> %d\n", url.c_str(), response.statusCode);
  Serial.printf("[HTTP] Response: %s\n", response.body.c_str());
  return response.ok;
}

bool NetworkService::sendFingerprintCallback(const models::DeviceConfig& config,
                                             const String& apiKey,
                                             const String& fingerprintId) {
  if (wifiStatus() != WL_CONNECTED) {
    Serial.println("[HTTP] Skip fingerprint callback because WiFi is disconnected.");
    lastHttpStatusCode_ = -1;
    return false;
  }

  const String payload = String("{\"mac_addr\":\"") + macAddress() +
                         "\",\"fingerprint_id\":\"" + fingerprintId + "\"}";
  const String url = buildBaseUrl(config) + config::network::kFingerprintCallbackEndpoint;

  Serial.printf("[Fingerprint] Sending callback for fingerprint_id=%s\n",
                fingerprintId.c_str());

  const models::HttpResponse response =
      http_.postJson(url, payload, buildAuthorization(apiKey));

  lastHttpStatusCode_ = response.statusCode;
  Serial.printf("[HTTP] POST %s -> %d\n", url.c_str(), response.statusCode);
  Serial.printf("[HTTP] Response: %s\n", response.body.c_str());
  return response.ok;
}

bool NetworkService::registerFingerprintCallback(const models::DeviceConfig& config,
                                             const String& apiKey,
                                             const String& fingerprintId,
                                             const String& templateData) {
  if (wifiStatus() != WL_CONNECTED) {
    Serial.println("[HTTP] Skip fingerprint callback because WiFi is disconnected.");
    lastHttpStatusCode_ = -1;
    return false;
  }

  const String payload = String("{\"mac_addr\":\"") + macAddress() +
                         "\",\"fingerprint_id\":\"" + fingerprintId + "\",\"template_data\":\"" + templateData + "\"}";
  const String url = buildBaseUrl(config) + config::network::kFingerprintCallbackEndpoint;

  Serial.printf("[Fingerprint] Sending callback for fingerprint_id=%s\n",
                fingerprintId.c_str());

  const models::HttpResponse response =
      http_.postJson(url, payload, buildAuthorization(apiKey));

  lastHttpStatusCode_ = response.statusCode;
  Serial.printf("[HTTP] POST %s -> %d\n", url.c_str(), response.statusCode);
  Serial.printf("[HTTP] Response: %s\n", response.body.c_str());
  return response.ok;
}

bool NetworkService::registerSyncMappingCallback(const models::DeviceConfig& config,
                                                 const String& apiKey,
                                                 uint32_t employeeId,
                                                 uint16_t fingerprintId) {
  if (wifiStatus() != WL_CONNECTED) {
    Serial.println("[HTTP] Skip sync-mapping callback because WiFi is disconnected.");
    lastHttpStatusCode_ = -1;
    return false;
  }

  const String payload = String("{\"mac_addr\":\"") + macAddress() +
                         "\",\"employee_id\":" + String(employeeId) +
                         ",\"fingerprint_id\":" + String(fingerprintId) + "}";
  const String url = buildBaseUrl(config) + config::network::kSyncMappingCallbackEndpoint;

  Serial.printf("[SyncMapping] Sending mapping for employee_id=%lu fingerprint_id=%u\n",
                employeeId, fingerprintId);

  const models::HttpResponse response =
      http_.postJson(url, payload, buildAuthorization(apiKey));

  lastHttpStatusCode_ = response.statusCode;
  Serial.printf("[HTTP] POST %s -> %d\n", url.c_str(), response.statusCode);
  Serial.printf("[HTTP] Response: %s\n", response.body.c_str());
  return response.ok;
}

String NetworkService::buildBaseUrl(const models::DeviceConfig& config) const {
  return String("http://") + config.serverIp + ":" + String(config.serverPort) +
         config::network::kApiBasePath;
}

String NetworkService::buildAuthorization(const String& apiKey) const {
  return String("Bearer ") + apiKey;
}

models::RemoteDeviceStatus NetworkService::parseRemoteStatus(const String& status) const {
  if (status == "ACTIVE") {
    return models::RemoteDeviceStatus::ACTIVE;
  }

  if (status == "INACTIVE") {
    return models::RemoteDeviceStatus::INACTIVE;
  }

  if (status == "MAINTENANCE") {
    return models::RemoteDeviceStatus::MAINTENANCE;
  }

  return models::RemoteDeviceStatus::UNKNOWN;
}
}  // namespace tk::services
