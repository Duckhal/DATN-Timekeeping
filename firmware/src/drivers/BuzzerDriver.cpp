#include "drivers/BuzzerDriver.h"

#include "Config/Config.h"

namespace tk::drivers {

static constexpr BuzzerDriver::Step kAckPattern[] = {
    {config::buzzer::kAckDurationMs, true},
};

static constexpr BuzzerDriver::Step kSuccessPattern[] = {
    {config::buzzer::kSuccessBeepMs, true},
    {config::buzzer::kSuccessPauseMs, false},
    {config::buzzer::kSuccessBeepMs, true},
};

static constexpr BuzzerDriver::Step kErrorPattern[] = {
    {config::buzzer::kErrorDurationMs, true},
};

BuzzerDriver::BuzzerDriver(uint8_t pin)
    : pin_(pin),
      state_(State::IDLE),
      pattern_(nullptr),
      patternLen_(0),
      stepIndex_(0),
      stepStartMs_(0) {}

void BuzzerDriver::begin() {
  pinMode(pin_, OUTPUT);
  digitalWrite(pin_, LOW);
  // Startup test beep to confirm hardware works in full app context
  digitalWrite(pin_, HIGH);
  delay(50);
  digitalWrite(pin_, LOW);
}

void BuzzerDriver::update() {
  if (state_ != State::PLAYING) return;

  if (stepIndex_ >= patternLen_) {
    digitalWrite(pin_, LOW);
    state_ = State::IDLE;
    return;
  }

  const uint32_t now = millis();
  if (now - stepStartMs_ >= pattern_[stepIndex_].durationMs) {
    stepIndex_++;
    if (stepIndex_ >= patternLen_) {
      digitalWrite(pin_, LOW);
      state_ = State::IDLE;
      return;
    }
    digitalWrite(pin_, pattern_[stepIndex_].on ? HIGH : LOW);
    stepStartMs_ = now;
  }
}

void BuzzerDriver::playAck() {
  startPattern(kAckPattern, sizeof(kAckPattern) / sizeof(kAckPattern[0]));
}

void BuzzerDriver::playSuccess() {
  startPattern(kSuccessPattern, sizeof(kSuccessPattern) / sizeof(kSuccessPattern[0]));
}

void BuzzerDriver::playError() {
  startPattern(kErrorPattern, sizeof(kErrorPattern) / sizeof(kErrorPattern[0]));
}

void BuzzerDriver::startPattern(const Step* steps, uint8_t count) {
  pattern_ = steps;
  patternLen_ = count;
  stepIndex_ = 0;
  stepStartMs_ = millis();
  state_ = State::PLAYING;
  digitalWrite(pin_, steps[0].on ? HIGH : LOW);
}

}  // namespace tk::drivers
