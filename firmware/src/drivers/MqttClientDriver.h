#pragma once

#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFi.h>

namespace tk::drivers {
using RawMqttCallback = void (*)(char*, uint8_t*, unsigned int);

class MqttClientDriver {
 public:
  MqttClientDriver();

  void setServer(const char* host, uint16_t port);
  void setCallback(RawMqttCallback callback);

  bool connect(const char* clientId);
  bool subscribe(const char* topic, uint8_t qos = 0);
  bool publish(const char* topic, const char* payload, bool retained = false);

  bool connected();
  int state();
  void loop();

 private:
  WiFiClient transport_;
  PubSubClient client_;
};
}  // namespace tk::drivers
