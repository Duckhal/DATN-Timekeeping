#include "services/MqttService.h"

#include "Config/Config.h"

namespace tk::services {
MqttService* MqttService::instance_ = nullptr;

MqttService::MqttService(drivers::MqttClientDriver& driver)
    : driver_(driver),
      commandTopic_(""),
      lastReconnectAttemptMs_(0),
      enrollCommandPending_(false),
      syncCommandPending_(false),
      syncEmployeeId_(0),
      syncTemplateData_(""),
      syncSourceMac_(""),
      deleteFingerPending_(false),
      deleteFingerLocalId_(0),
      statusUpdatePending_(false),
      pendingStatus_(models::RemoteDeviceStatus::UNKNOWN),
      bulkSyncPending_(false) {}

void MqttService::begin() {
  instance_ = this;
  driver_.setCallback(onRawMessage);
}

bool MqttService::connectIfNeeded(const String& brokerHost, const String& macAddress,
                                  uint16_t brokerPort, uint32_t reconnectIntervalMs) {
  if (driver_.connected()) {
    return true;
  }

  const uint32_t now = millis();
  if (now - lastReconnectAttemptMs_ < reconnectIntervalMs) {
    return false;
  }

  lastReconnectAttemptMs_ = now;

  commandTopic_ = buildTopicFromMac(macAddress);
  const String clientId = buildClientIdFromMac(macAddress);

  Serial.printf("[MQTT] Target broker=%s:%u clientId=%s\n",
                brokerHost.c_str(), brokerPort, clientId.c_str());

  driver_.setServer(brokerHost.c_str(), brokerPort);

  const bool connected = driver_.connect(clientId.c_str());
  if (!connected) {
    Serial.printf("[MQTT] Connect failed. rc=%d\n", driver_.state());
    return false;
  }

  const bool subscribed = driver_.subscribe(commandTopic_.c_str(), 1);
  const bool public_subscribed = driver_.subscribe(config::network::kMqttBroadcastSyncTopic, 1);
  Serial.printf("[MQTT] Connected. Subscribe %s -> %s\n",
                commandTopic_.c_str(), subscribed ? "OK" : "FAILED");
  Serial.printf("[MQTT] Connected. Subscribe %s -> %s\n",
                config::network::kMqttBroadcastSyncTopic, public_subscribed ? "OK" : "FAILED");
  return subscribed;
}

void MqttService::loop() {
  if (driver_.connected()) {
    driver_.loop();
  }
}

bool MqttService::consumeEnrollCommand() {
  if (!enrollCommandPending_) {
    return false;
  }

  enrollCommandPending_ = false;
  return true;
}

bool MqttService::consumeSyncCommand(uint32_t& outEmployeeId,
                                     String& outTemplateData,
                                     String& outSourceMac) {
  if (!syncCommandPending_) {
    return false;
  }

  outEmployeeId = syncEmployeeId_;
  outTemplateData = syncTemplateData_;
  outSourceMac = syncSourceMac_;
  syncCommandPending_ = false;
  return true;
}

bool MqttService::consumeDeleteFingerCommand(uint16_t& outLocalId) {
  if (!deleteFingerPending_) {
    return false;
  }

  outLocalId = deleteFingerLocalId_;
  deleteFingerPending_ = false;
  return true;
}

bool MqttService::consumeStatusUpdate(models::RemoteDeviceStatus& outStatus) {
  if (!statusUpdatePending_) {
    return false;
  }

  outStatus = pendingStatus_;
  statusUpdatePending_ = false;
  return true;
}

bool MqttService::consumeBulkSyncCommand() {
  if (!bulkSyncPending_) {
    return false;
  }

  bulkSyncPending_ = false;
  return true;
}

void MqttService::onRawMessage(char* topic, uint8_t* payload, unsigned int length) {
  if (!instance_) {
    return;
  }

  instance_->handleMessage(topic, payload, length);
}

void MqttService::handleMessage(char* topic, uint8_t* payload, unsigned int length) {
  if (!topic || !payload || length == 0) {
    return;
  }

  DynamicJsonDocument doc(2048);
  const DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.printf("[MQTT] Invalid JSON command: %s\n", err.c_str());
    return;
  }

  const String command = doc["command"] | "";
  Serial.printf("[MQTT] Topic=%s Command=%s\n", topic, command.c_str());

  if (command == "ENROLL_FINGERPRINT") {
    enrollCommandPending_ = true;
  }

  if (command == "DELETE_FINGER") {
    const long localId = doc["local_id"] | -1L;
    if (localId < 1) {
      Serial.println("[MQTT] DELETE_FINGER missing/invalid local_id.");
      return;
    }
    deleteFingerLocalId_ = (uint16_t)localId;
    deleteFingerPending_ = true;
    Serial.printf("[MQTT] Received DELETE_FINGER. local_id=%u\n", deleteFingerLocalId_);
  }

  if (command == "SYNC_FINGERPRINT") {
    const String employeeIdStr = doc["employee_id"] | "";
    const String templateData = doc["template_data"] | "";
    const String sourceMac = doc["mac_addr"] | "";
    if (employeeIdStr.length() == 0 || templateData.length() == 0) {
      Serial.println("[MQTT] Missing employee_id or template_data for SYNC_FINGERPRINT command.");
      return;
    }

    uint32_t employeeId = (uint32_t)employeeIdStr.toInt();

    syncEmployeeId_ = employeeId;
    syncTemplateData_ = templateData;
    syncSourceMac_ = sourceMac;
    syncCommandPending_ = true;

    Serial.printf("[MQTT] Received SYNC_FINGERPRINT command. employee_id=%lu source_mac=%s\n",
                  (unsigned long)employeeId, sourceMac.c_str());
  }

  if (command == "STATUS_UPDATE") {
    const String status = doc["status"] | "";
    models::RemoteDeviceStatus parsed = parseStatus(status);
    if (parsed != models::RemoteDeviceStatus::UNKNOWN) {
      pendingStatus_ = parsed;
      statusUpdatePending_ = true;
      Serial.printf("[MQTT] Received STATUS_UPDATE. status=%s\n", status.c_str());
    }
  }

  if (command == "START_BULK_SYNC") {
    bulkSyncPending_ = true;
    Serial.println("[MQTT] Received START_BULK_SYNC command.");
  }
}

String MqttService::buildTopicFromMac(const String& macAddress) const {
  return String("timekeeping/device/") + macAddress + "/command";
}

String MqttService::buildClientIdFromMac(const String& macAddress) const {
  String clientId = String("timekeeping-") + macAddress;
  clientId.replace(":", "");
  return clientId;
}

models::RemoteDeviceStatus MqttService::parseStatus(const String& s) {
  if (s == "ACTIVE") return models::RemoteDeviceStatus::ACTIVE;
  if (s == "INACTIVE") return models::RemoteDeviceStatus::INACTIVE;
  if (s == "MAINTENANCE") return models::RemoteDeviceStatus::MAINTENANCE;
  return models::RemoteDeviceStatus::UNKNOWN;
}
}  // namespace tk::services
