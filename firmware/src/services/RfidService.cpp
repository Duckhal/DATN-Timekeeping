#include "services/RfidService.h"

#include <ArduinoJson.h>

namespace tk::services {
namespace {
constexpr uint32_t kResultHoldMs = 1500;
}

RfidService::RfidService(drivers::RfidDriver& rfid,
                         DisplayService& display,
                         NetworkService& network,
                         drivers::BuzzerDriver& buzzer)
    : rfid_(rfid),
      display_(display),
      network_(network),
      buzzer_(buzzer),
      state_(State::IDLE),
      resultShownAtMs_(0) {}

void RfidService::begin() {
  rfid_.begin();
}

void RfidService::tick(const models::DeviceConfig& config,
                       const String& apiKey,
                       bool allowed) {
  const uint32_t now = millis();

  if (state_ == State::SHOWING_RESULT) {
    if (now - resultShownAtMs_ < kResultHoldMs) {
      return;
    }
    display_.showWelcome();
    state_ = State::WAIT_CARD_RELEASE;
    return;
  }

  if (state_ == State::WAIT_CARD_RELEASE) {
    if (!rfid_.isCardPresent()) {
      state_ = State::IDLE;
    }
    return;
  }

  if (!allowed) {
    return;
  }

  String uid;
  if (!rfid_.readUidHex(uid)) {
    return;
  }

  buzzer_.playAck();

  const String clientTxId = generateClientTxId(uid);
  String body;
  const bool ok = network_.sendRfidCheckin(config, apiKey, uid, clientTxId, body);

  if (!ok && body.length() == 0) {
    Serial.println("[RFID] Network failure while posting checkin.");
    display_.showCheckinDenied();
    buzzer_.playError();
    enterResultState();
    return;
  }

  parseAndApply(body);
  enterResultState();
}

bool RfidService::isBusy() const {
  return state_ != State::IDLE;
}

void RfidService::parseAndApply(const String& body) {
  StaticJsonDocument<384> doc;
  const DeserializationError err = deserializeJson(doc, body);
  if (err) {
    Serial.printf("[RFID] Invalid response JSON: %s\n", err.c_str());
    display_.showCheckinDenied();
    buzzer_.playError();
    return;
  }

  const String status = doc["status"] | "";

  if (status == "ok") {
    const String name = doc["employee_name"] | "";
    const char* kind = doc["kind"] | "";
    Serial.printf("[RFID] OK employee=%s kind=%s\n", name.c_str(), kind);
    display_.showCheckinSuccess(name);
    buzzer_.playSuccess();
    return;
  }

  if (status == "duplicate") {
    const String name = doc["employee_name"] | "";
    Serial.printf("[RFID] Duplicate scan employee=%s\n", name.c_str());
    display_.showAlreadyCheckedIn(name);
    buzzer_.playSuccess();
    return;
  }

  if (status == "invalid_credential") {
    Serial.println("[RFID] Card not recognized.");
    display_.showCardNotRecognized();
    buzzer_.playError();
    return;
  }

  Serial.printf("[RFID] Unknown response status=%s\n", status.c_str());
  display_.showCheckinDenied();
  buzzer_.playError();
}

void RfidService::enterResultState() {
  state_ = State::SHOWING_RESULT;
  resultShownAtMs_ = millis();
}

String RfidService::generateClientTxId(const String& uid) const {
  char buf[48];
  snprintf(buf, sizeof(buf), "%08lx%08lx-%s-%lu",
           (unsigned long)esp_random(),
           (unsigned long)esp_random(),
           uid.c_str(),
           (unsigned long)millis());
  return String(buf);
}
}  // namespace tk::services
