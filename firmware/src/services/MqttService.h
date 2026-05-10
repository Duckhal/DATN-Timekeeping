#pragma once

#include <ArduinoJson.h>

#include "drivers/MqttClientDriver.h"

namespace tk::services {
class MqttService {
 public:
  explicit MqttService(drivers::MqttClientDriver& driver);

  void begin();
  bool connectIfNeeded(const String& brokerHost, const String& macAddress,
                       uint16_t brokerPort, uint32_t reconnectIntervalMs);
  void loop();

  bool consumeEnrollCommand();
  bool consumeSyncCommand(uint32_t& outEmployeeId,
                          String& outTemplateData,
                          String& outSourceMac);
  bool consumeDeleteFingerCommand(uint16_t& outLocalId);

 private:
  static void onRawMessage(char* topic, uint8_t* payload, unsigned int length);
  void handleMessage(char* topic, uint8_t* payload, unsigned int length);

  String buildTopicFromMac(const String& macAddress) const;
  String buildClientIdFromMac(const String& macAddress) const;

  drivers::MqttClientDriver& driver_;
  String commandTopic_;
  uint32_t lastReconnectAttemptMs_;
  bool enrollCommandPending_;

  bool syncCommandPending_;
  uint32_t syncEmployeeId_;
  String syncTemplateData_;
  String syncSourceMac_;

  bool deleteFingerPending_;
  uint16_t deleteFingerLocalId_;

  static MqttService* instance_;
};
}  // namespace tk::services
