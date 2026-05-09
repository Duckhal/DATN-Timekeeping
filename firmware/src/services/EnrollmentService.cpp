#include "services/EnrollmentService.h"

#include <Adafruit_Fingerprint.h>

namespace tk::services {
EnrollmentService::EnrollmentService(drivers::FingerprintDriver& fingerprint,
                                     DisplayService& display,
                                     NetworkService& network)
    : fingerprint_(fingerprint),
      display_(display),
      network_(network),
      runtimeState_(RuntimeState::NORMAL),
      state_(State::IDLE),
      sensorReady_(false),
      targetId_(0),
      enrollStartedAtMs_(0),
      enrollResultShownAtMs_(0),
      lastSensorInitAttemptMs_(0) {}

bool EnrollmentService::initSensor(bool forceLog, uint32_t retryIntervalMs) {
  const uint32_t now = millis();
  if (!forceLog && now - lastSensorInitAttemptMs_ < retryIntervalMs) {
    return sensorReady_;
  }

  lastSensorInitAttemptMs_ = now;

  fingerprint_.begin();
  const bool verified = fingerprint_.verifyPassword();
  if (forceLog || verified != sensorReady_) {
    Serial.printf("[Fingerprint] Sensor verify=%s\n", verified ? "OK" : "FAILED");
  }

  sensorReady_ = verified;
  return sensorReady_;
}

bool EnrollmentService::sensorReady() const {
  return sensorReady_;
}

void EnrollmentService::startIfAllowed(bool isDeviceActive) {
  if (!sensorReady_) {
    Serial.println("[Enroll] Fingerprint sensor is not ready.");
    failEnrollment();
    return;
  }

  if (!isDeviceActive) {
    Serial.println("[Enroll] Ignore command because device is not ACTIVE.");
    return;
  }

  runtimeState_ = RuntimeState::ENROLLING;
  state_ = State::FIND_EMPTY_SLOT;
  enrollStartedAtMs_ = millis();
  targetId_ = 0;
}

void EnrollmentService::tick(const models::DeviceConfig& config,
                             const String& apiKey,
                             uint32_t enrollTimeoutMs,
                             uint8_t maxTemplateId) {
  if (runtimeState_ != RuntimeState::ENROLLING) {
    return;
  }

  if (millis() - enrollStartedAtMs_ > enrollTimeoutMs &&
      state_ != State::SUCCESS && state_ != State::FAILED) {
    Serial.println("[Enroll] Timeout.");
    failEnrollment();
    return;
  }

  if (state_ == State::FIND_EMPTY_SLOT) {
    targetId_ = findFirstFreeTemplateId(maxTemplateId);
    if (targetId_ == 0) {
      Serial.println("[Enroll] No free fingerprint slot found.");
      failEnrollment();
      return;
    }

    display_.showEnrollModePlaceFinger();
    state_ = State::WAIT_FINGER_1;
    return;
  }

  if (state_ == State::WAIT_FINGER_1) {
    const uint8_t imageResult = fingerprint_.getImage();
    if (imageResult == FINGERPRINT_NOFINGER) {
      return;
    }

    if (imageResult != FINGERPRINT_OK) {
      Serial.printf("[Enroll] First getImage failed: %u\n", imageResult);
      failEnrollment();
      return;
    }

    const uint8_t tzResult = fingerprint_.image2Tz(1);
    if (tzResult != FINGERPRINT_OK) {
      Serial.printf("[Enroll] First image2Tz failed: %u\n", tzResult);
      failEnrollment();
      return;
    }

    display_.showEnrollModeRemoveFinger();
    state_ = State::WAIT_REMOVE;
    return;
  }

  if (state_ == State::WAIT_REMOVE) {
    const uint8_t imageResult = fingerprint_.getImage();
    if (imageResult != FINGERPRINT_NOFINGER) {
      return;
    }

    display_.showEnrollModePlaceSameFinger();
    state_ = State::WAIT_FINGER_2;
    return;
  }

  if (state_ == State::WAIT_FINGER_2) {
    const uint8_t imageResult = fingerprint_.getImage();
    if (imageResult == FINGERPRINT_NOFINGER) {
      return;
    }

    if (imageResult != FINGERPRINT_OK) {
      Serial.printf("[Enroll] Second getImage failed: %u\n", imageResult);
      failEnrollment();
      return;
    }

    const uint8_t tzResult = fingerprint_.image2Tz(2);
    if (tzResult != FINGERPRINT_OK) {
      Serial.printf("[Enroll] Second image2Tz failed: %u\n", tzResult);
      failEnrollment();
      return;
    }

    const uint8_t modelResult = fingerprint_.createModel();
    if (modelResult != FINGERPRINT_OK) {
      Serial.printf("[Enroll] createModel failed: %u\n", modelResult);
      failEnrollment();
      return;
    }

    const uint8_t storeResult = fingerprint_.storeModel(targetId_);
    if (storeResult != FINGERPRINT_OK) {
      Serial.printf("[Enroll] storeModel failed: %u\n", storeResult);
      failEnrollment();
      return;
    }
    const String templateData = fingerprint_.getTemplateAsHex(targetId_);

    succeedEnrollment(config, apiKey, templateData);
    return;
  }

  if ((state_ == State::SUCCESS || state_ == State::FAILED) &&
      millis() - enrollResultShownAtMs_ >= 1500) {
    runtimeState_ = RuntimeState::NORMAL;
    state_ = State::IDLE;
    targetId_ = 0;
    display_.showWelcome();
  }
}

uint8_t EnrollmentService::findFirstFreeTemplateId(uint8_t maxTemplateId) {
  for (uint8_t id = 1; id <= maxTemplateId; id++) {
    const uint8_t result = fingerprint_.loadModel(id);
    if (result != FINGERPRINT_OK) {
      return id;
    }
  }

  return 0;
}

void EnrollmentService::failEnrollment() {
  runtimeState_ = RuntimeState::ENROLLING;
  state_ = State::FAILED;
  display_.showEnrollFailed();
  enrollResultShownAtMs_ = millis();
}

void EnrollmentService::succeedEnrollment(const models::DeviceConfig& config,
                                          const String& apiKey,
                                          const String& templateData) {
  const bool callbackOk =
      network_.registerFingerprintCallback(config, apiKey, String(targetId_), templateData);

  const int callbackStatus = network_.getLastHttpStatusCode();
  Serial.printf("[Enroll] Callback result: %s (http=%d)\n",
                callbackOk ? "SUCCESS" : "FAILED", callbackStatus);

  if (!callbackOk) {
    failEnrollment();
    return;
  }

  state_ = State::SUCCESS;
  display_.showEnrollSuccess(targetId_);
  enrollResultShownAtMs_ = millis();
}
}  // namespace tk::services
