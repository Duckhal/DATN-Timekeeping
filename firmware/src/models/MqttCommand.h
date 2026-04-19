#pragma once

#include <Arduino.h>

namespace tk::models {
enum class MqttCommandType : unsigned char {
  UNKNOWN,
  ENROLL_FINGERPRINT,
};

struct MqttCommand {
  MqttCommandType type;
  String raw;
};
}  // namespace tk::models
