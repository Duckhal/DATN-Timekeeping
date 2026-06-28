#include "services/CheckinService.h"

#include <ArduinoJson.h>

#include "Config/Config.h"

namespace tk::services {

namespace {
constexpr uint32_t kResultHoldMs = 2000;
}

CheckinService::CheckinService(drivers::FingerprintDriver& fingerprint,
                               DisplayService& display,
                               NetworkService& network,
                               drivers::BuzzerDriver& buzzer)
    : fingerprint_(fingerprint),
      display_(display),
      network_(network),
      buzzer_(buzzer),
      state_(State::IDLE),
      resultShownAtMs_(0),
      lastMatchedId_(0) {}

void CheckinService::tick(const models::DeviceConfig& config,
                          const String& apiKey,
                          bool allowed) {
  const uint32_t now = millis();

  if (state_ == State::SHOWING_RESULT) {
    if (now - resultShownAtMs_ < kResultHoldMs) {
      return;
    }
    display_.showWelcome();
    state_ = State::WAIT_FINGER_RELEASE;
    return;
  }

  if (state_ == State::WAIT_FINGER_RELEASE) {
    const uint8_t imageResult = fingerprint_.getImage();
    if (imageResult == FINGERPRINT_NOFINGER) {
      state_ = State::IDLE;
    }
    return;
  }

  if (!allowed) {
    return;
  }

  uint16_t matchedId = 0;
  uint16_t confidence = 0;
  const drivers::FingerprintDriver::MatchResult match =
      fingerprint_.tryMatchFinger(matchedId, confidence);

  if (match == drivers::FingerprintDriver::MatchResult::NO_FINGER) {
    return;
  }

  if (match == drivers::FingerprintDriver::MatchResult::NO_MATCH) {
    Serial.println("[Checkin] Finger placed but no match found.");
    display_.showCheckinDenied();
    buzzer_.playError();
    enterResultState();
    return;
  }

  Serial.printf("[Checkin] Match slot=%u confidence=%u\n", matchedId, confidence);
  buzzer_.playAck();

  const String clientTxId = generateClientTxId(matchedId);
  String body;
  const bool ok = network_.sendCheckin(config, apiKey, matchedId, clientTxId, body);

  if (!ok && body.length() == 0) {
    Serial.println("[Checkin] Network failure while posting checkin.");
    display_.showCheckinDenied();
    buzzer_.playError();
    enterResultState();
    return;
  }

  parseAndApply(matchedId, body);
  enterResultState();
}

void CheckinService::parseAndApply(uint16_t matchedId, const String& body) {
  lastMatchedId_ = matchedId;

  StaticJsonDocument<384> doc;
  const DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("[Checkin] Invalid response JSON: %s\n", err.c_str());
    display_.showCheckinDenied();
    buzzer_.playError();
    return;
  }

  const String status = doc["status"] | "";

  if (status == "ok") {
    const String name = doc["employee_name"] | "";
    const char* kind = doc["kind"] | "";
    Serial.printf("[Checkin] OK employee=%s kind=%s\n", name.c_str(), kind);
    display_.showCheckinSuccess(name);
    buzzer_.playSuccess();
    return;
  }

  if (status == "invalid_credential") {
    const String action = doc["action"] | "";
    if (action == "FORCE_DELETE_LOCAL") {
      const long localId = doc["local_id"] | -1L;
      if (localId >= 1) {
        const uint16_t slot = (uint16_t)localId;
        const uint16_t delResult = fingerprint_.deleteModel(slot);
        Serial.printf("[Checkin] Ghost cleanup deleteModel(%u) -> %u\n", slot, delResult);
      }
    }
    display_.showCheckinDenied();
    buzzer_.playError();
    return;
  }

  Serial.printf("[Checkin] Unknown response status=%s\n", status.c_str());
  display_.showCheckinDenied();
  buzzer_.playError();
}

bool CheckinService::isBusy() const {
  return state_ != State::IDLE;
}

void CheckinService::enterResultState() {
  state_ = State::SHOWING_RESULT;
  resultShownAtMs_ = millis();
}

String CheckinService::generateClientTxId(uint16_t localId) const {
  // 16 random hex chars + slot + millis. Enough entropy for idempotency within
  // a single device's lifetime and obvious correlation when debugging.
  char buf[40];
  snprintf(buf, sizeof(buf), "%08lx%08lx-%u-%lu",
           (unsigned long)esp_random(),
           (unsigned long)esp_random(),
           localId,
           (unsigned long)millis());
  return String(buf);
}

}  // namespace tk::services
