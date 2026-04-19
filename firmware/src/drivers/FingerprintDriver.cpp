#include "drivers/FingerprintDriver.h"

namespace tk::drivers {
FingerprintDriver::FingerprintDriver(HardwareSerial& serialPort, uint8_t rxPin,
                                     uint8_t txPin, uint32_t baudRate)
    : serialPort_(serialPort),
      rxPin_(rxPin),
      txPin_(txPin),
      baudRate_(baudRate),
      fingerprint_(&serialPort_) {}

void FingerprintDriver::begin() {
  serialPort_.begin(baudRate_, SERIAL_8N1, rxPin_, txPin_);
  fingerprint_.begin(baudRate_);
}

bool FingerprintDriver::verifyPassword() {
  return fingerprint_.verifyPassword();
}

uint8_t FingerprintDriver::getImage() {
  return fingerprint_.getImage();
}

uint8_t FingerprintDriver::image2Tz(uint8_t slot) {
  return fingerprint_.image2Tz(slot);
}

uint8_t FingerprintDriver::createModel() {
  return fingerprint_.createModel();
}

uint8_t FingerprintDriver::storeModel(uint8_t id) {
  return fingerprint_.storeModel(id);
}

uint8_t FingerprintDriver::loadModel(uint8_t id) {
  return fingerprint_.loadModel(id);
}
}  // namespace tk::drivers
