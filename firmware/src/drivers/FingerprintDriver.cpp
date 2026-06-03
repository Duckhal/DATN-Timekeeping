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

uint16_t FingerprintDriver::storeModel(uint16_t id) {
  return fingerprint_.storeModel(id);
}

uint16_t FingerprintDriver::loadModel(uint16_t id) {
  return fingerprint_.loadModel(id);
}

uint16_t FingerprintDriver::deleteModel(uint16_t id) {
  return fingerprint_.deleteModel(id);
}

uint16_t FingerprintDriver::findFirstFreeSlot(uint16_t maxId) {
  for (uint16_t id = 1; id <= maxId; id++) {
    const uint8_t result = fingerprint_.loadModel(id);
    if (result != FINGERPRINT_OK) {
      return id;
    }
  }
  return 0;
}

FingerprintDriver::MatchResult FingerprintDriver::tryMatchFinger(uint16_t& outId, uint16_t& outConfidence) {
  const uint8_t imageResult = fingerprint_.getImage();
  if (imageResult == FINGERPRINT_NOFINGER) {
    return MatchResult::NO_FINGER;
  }
  if (imageResult != FINGERPRINT_OK) {
    // Capture error (blurred, poor contact). Treat as "finger present, unknown".
    return MatchResult::NO_MATCH;
  }

  const uint8_t tzResult = fingerprint_.image2Tz(1);
  if (tzResult != FINGERPRINT_OK) {
    return MatchResult::NO_MATCH;
  }

  const uint8_t searchResult = fingerprint_.fingerFastSearch();
  if (searchResult != FINGERPRINT_OK) {
    return MatchResult::NO_MATCH;
  }

  outId = fingerprint_.fingerID;
  outConfidence = fingerprint_.confidence;
  return MatchResult::MATCHED;
}

String FingerprintDriver::getTemplateAsHex(uint16_t id) {
  if (fingerprint_.loadModel(id) != FINGERPRINT_OK) return "";
  if (fingerprint_.getModel() != FINGERPRINT_OK) return "";

  uint8_t rawTemplate[512];
  uint32_t dataIdx = 0;
  uint32_t starttime = millis();
  bool done = false;

  while (!done && (millis() - starttime) < 3000) { // Limit total execution time to 3 seconds
    if (serialPort_.available() >= 9) {
      if (serialPort_.read() == 0xEF && serialPort_.peek() == 0x01) {
        serialPort_.read(); // 0x01
        
        // FIX: Replace unconditional while loops with safe timeout checks
        uint8_t headerBuf[7];
        uint32_t readBytes = serialPort_.readBytes(headerBuf, 7); // Built-in read timeout
        if (readBytes < 7) return ""; 

        uint8_t pid = headerBuf[4];
        uint16_t dataLen = (headerBuf[5] << 8) | headerBuf[6];
        uint16_t payloadLen = dataLen - 2;
        
        // Safely read payload data
        for (uint16_t i = 0; i < payloadLen; i++) {
          uint32_t byteTimeout = millis();
          while (!serialPort_.available()) {
            if ((millis() - byteTimeout) > 100) return ""; // Abort if no byte received within 100ms to prevent chip hang
          }
          uint8_t d = serialPort_.read();
          if (dataIdx < sizeof(rawTemplate)) {
            rawTemplate[dataIdx++] = d;
          }
        }
        
        // Read the last 2 Checksum bytes
        uint8_t crcBuf[2];
        serialPort_.readBytes(crcBuf, 2);
        
        if (pid == 0x08) done = true;
      }
    }
  }

  if (dataIdx < 512) return "";

  String hexData = "";
  hexData.reserve(1024);
  for (int j = 0; j < 512; j++) {
    if (rawTemplate[j] < 0x10) hexData += "0";
    hexData += String(rawTemplate[j], HEX);
  }
  hexData.toUpperCase();
  return hexData;
}

bool FingerprintDriver::setTemplateFromHex(uint16_t id, const String& hexData) {
  if (hexData.length() != 1024) return false;

  uint8_t rawTemplate[512];
  for (int i = 0; i < 512; i++) {
    String byteStr = hexData.substring(i * 2, i * 2 + 2);
    rawTemplate[i] = (uint8_t)strtol(byteStr.c_str(), NULL, 16);
  }

  while (serialPort_.available()) serialPort_.read();

  uint8_t downCharCmd[] = {0xEF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x04, 0x09, 0x01, 0x00, 0x0F};
  serialPort_.write(downCharCmd, sizeof(downCharCmd));
  delay(50);
  while (serialPort_.available()) serialPort_.read();

  for (int p = 0; p < 4; p++) {
    uint8_t packet[139];
    packet[0] = 0xEF; packet[1] = 0x01;
    packet[2] = 0xFF; packet[3] = 0xFF; packet[4] = 0xFF; packet[5] = 0xFF;
    packet[6] = (p == 3) ? 0x08 : 0x02; 
    packet[7] = 0x00; packet[8] = 0x82; // Length: 130 bytes

    // FIX: Calculate checksum using standard byte-wise sum
    uint16_t checksum = packet[6] + packet[7] + packet[8]; 
    
    for (int i = 0; i < 128; i++) {
       uint8_t dataByte = rawTemplate[p * 128 + i];
       packet[9 + i] = dataByte;
       checksum += dataByte; // Safe byte accumulation
    }
    packet[137] = (checksum >> 8) & 0xFF;
    packet[138] = checksum & 0xFF;

    serialPort_.write(packet, sizeof(packet));
    delay(60); // Increase to 60ms to let DSP safely process pagination
    while (serialPort_.available()) serialPort_.read(); 
  }

  uint8_t storeResult = fingerprint_.storeModel(id);
  if (storeResult != FINGERPRINT_OK) {
    Serial.printf("[Fingerprint] Store failed with code: 0x%02X\n", storeResult);
    return false;
  }
  return true;
}
}  // namespace tk::drivers
