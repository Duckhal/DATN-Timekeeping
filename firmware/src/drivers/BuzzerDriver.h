#pragma once

#include <Arduino.h>

namespace tk::drivers {
class BuzzerDriver {
 public:
  struct Step {
    uint16_t durationMs;
    bool on;
  };

  explicit BuzzerDriver(uint8_t pin);
  void begin();
  void update();

  void playAck();
  void playSuccess();
  void playError();

 private:
  enum class State : uint8_t { IDLE, PLAYING };

  void startPattern(const Step* steps, uint8_t count);

  uint8_t pin_;
  State state_;
  const Step* pattern_;
  uint8_t patternLen_;
  uint8_t stepIndex_;
  uint32_t stepStartMs_;
};
}  // namespace tk::drivers
