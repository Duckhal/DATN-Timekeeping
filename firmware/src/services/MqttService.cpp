#include "services/MqttService.h"

namespace tk::services {
MqttService* MqttService::instance_ = nullptr;

MqttService::MqttService(drivers::MqttClientDriver& driver)
    : driver_(driver),
      commandTopic_(""),
      lastReconnectAttemptMs_(0),
      enrollCommandPending_(false) {}

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
  Serial.printf("[MQTT] Connected. Subscribe %s -> %s\n",
                commandTopic_.c_str(), subscribed ? "OK" : "FAILED");
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

  StaticJsonDocument<128> doc;
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
}

String MqttService::buildTopicFromMac(const String& macAddress) const {
  return String("timekeeping/device/") + macAddress + "/command";
}

String MqttService::buildClientIdFromMac(const String& macAddress) const {
  String clientId = String("timekeeping-") + macAddress;
  clientId.replace(":", "");
  return clientId;
}
}  // namespace tk::services
