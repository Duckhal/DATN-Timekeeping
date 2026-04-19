#include "drivers/MqttClientDriver.h"

namespace tk::drivers {
MqttClientDriver::MqttClientDriver() : client_(transport_) {}

void MqttClientDriver::setServer(const char* host, uint16_t port) {
  client_.setServer(host, port);
}

void MqttClientDriver::setCallback(RawMqttCallback callback) {
  client_.setCallback(callback);
}

bool MqttClientDriver::connect(const char* clientId) {
  return client_.connect(clientId);
}

bool MqttClientDriver::subscribe(const char* topic, uint8_t qos) {
  return client_.subscribe(topic, qos);
}

bool MqttClientDriver::publish(const char* topic, const char* payload, bool retained) {
  return client_.publish(topic, payload, retained);
}

bool MqttClientDriver::connected() {
  return client_.connected();
}

int MqttClientDriver::state() {
  return client_.state();
}

void MqttClientDriver::loop() {
  client_.loop();
}
}  // namespace tk::drivers
