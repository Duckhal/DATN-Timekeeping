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

bool FingerprintDriver::tryMatchFinger(uint16_t& outId, uint16_t& outConfidence) {
  const uint8_t imageResult = fingerprint_.getImage();
  if (imageResult != FINGERPRINT_OK) {
    return false;
  }

  const uint8_t tzResult = fingerprint_.image2Tz(1);
  if (tzResult != FINGERPRINT_OK) {
    return false;
  }

  const uint8_t searchResult = fingerprint_.fingerFastSearch();
  if (searchResult != FINGERPRINT_OK) {
    return false;
  }

  outId = fingerprint_.fingerID;
  outConfidence = fingerprint_.confidence;
  return true;
}

String FingerprintDriver::getTemplateAsHex(uint16_t id) {
  // 1. Tải dữ liệu từ Flash lên CharBuffer 1
  uint8_t result = fingerprint_.loadModel(id);
  if (result != FINGERPRINT_OK) {
    Serial.println("[Fingerprint] Error loading model into CharBuffer.");
    return "";
  }

  // 2. Yêu cầu đẩy CharBuffer 1 qua UART
  result = fingerprint_.getModel();
  if (result != FINGERPRINT_OK) {
    Serial.println("[Fingerprint] Error requesting getModel.");
    return "";
  }

  // 3. Hứng đúng 534 bytes (2 gói tin, mỗi gói 267 bytes: 9 Header + 256 Data + 2 Checksum)
  uint8_t bytesReceived[534];
  memset(bytesReceived, 0, 534);

  uint32_t starttime = millis();
  int i = 0;
  // Timeout an toàn là 2000ms (2 giây) cho thao tác đọc Serial
  while (i < 534 && (millis() - starttime) < 2000) {
    if (serialPort_.available()) {
      bytesReceived[i++] = serialPort_.read();
    }
  }

  if (i < 534) {
    Serial.printf("[Fingerprint] Timeout. Only read %d/534 bytes.\n", i);
    return "";
  }

  // 4. Bóc tách (Parse) để lấy 512 bytes dữ liệu nguyên chất
  uint8_t rawTemplate[512];
  
  // Gói 1: Bỏ qua 9 bytes đầu, copy 256 bytes payload
  memcpy(rawTemplate, bytesReceived + 9, 256);
  // Gói 2: Bỏ qua (9 + 256 + 2) = 267 bytes của gói 1, cộng thêm 9 bytes header của gói 2
  memcpy(rawTemplate + 256, bytesReceived + 267 + 9, 256);

  // 5. Chuyển đổi mảng 512 bytes thành chuỗi Hex (1024 ký tự)
  String hexData = "";
  hexData.reserve(1024);
  for (int j = 0; j < 512; j++) {
    if (rawTemplate[j] < 0x10) hexData += "0";
    hexData += String(rawTemplate[j], HEX);
  }
  
  hexData.toUpperCase();
  Serial.println("[Fingerprint] Successfully extracted template to Hex.");
  return hexData;
}

bool FingerprintDriver::setTemplateFromHex(uint16_t id, const String& hexData) {
  // 1. Kiểm tra tính hợp lệ của chuỗi đầu vào (phải chẵn 1024 ký tự tương đương 512 bytes)
  if (hexData.length() != 1024) {
    Serial.println("[Fingerprint] Invalid Hex length. Expected 1024 characters.");
    return false;
  }

  // 2. Ép kiểu chuỗi Hex về lại mảng 512 bytes
  uint8_t rawTemplate[512];
  for (int i = 0; i < 512; i++) {
    String byteStr = hexData.substring(i * 2, i * 2 + 2);
    rawTemplate[i] = (uint8_t)strtol(byteStr.c_str(), NULL, 16);
  }

  // Xóa rác trong buffer Serial trước khi bắt đầu
  while (serialPort_.available()) serialPort_.read();

  // 3. Gửi lệnh DownChar (0x09) vào CharBuffer 1 (0x01)
  uint8_t downCharCmd[] = {0xEF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x04, 0x09, 0x01, 0x00, 0x0F};
  serialPort_.write(downCharCmd, sizeof(downCharCmd));
  delay(50);
  
  // Đọc ACK từ cảm biến (thường bỏ qua nội dung ACK để tối ưu tốc độ)
  while (serialPort_.available()) serialPort_.read();

  // 4. Gửi Gói dữ liệu 1 (256 bytes đầu)
  uint8_t packet1[267];
  packet1[0] = 0xEF; packet1[1] = 0x01; // Header
  packet1[2] = 0xFF; packet1[3] = 0xFF; packet1[4] = 0xFF; packet1[5] = 0xFF; // Address
  packet1[6] = 0x02; // Packet ID: 0x02 (Data Packet thông thường)
  packet1[7] = 0x01; packet1[8] = 0x02; // Length: 258 bytes (256 data + 2 checksum)

  uint16_t checksum1 = packet1[6] + packet1[7] + packet1[8];
  for (int i = 0; i < 256; i++) {
    packet1[9 + i] = rawTemplate[i];
    checksum1 += rawTemplate[i];
  }
  packet1[265] = (checksum1 >> 8) & 0xFF; // Checksum High Byte
  packet1[266] = checksum1 & 0xFF;        // Checksum Low Byte

  serialPort_.write(packet1, sizeof(packet1));
  delay(50);
  while (serialPort_.available()) serialPort_.read();

  // 5. Gửi Gói dữ liệu 2 (256 bytes cuối)
  uint8_t packet2[267];
  packet2[0] = 0xEF; packet2[1] = 0x01; 
  packet2[2] = 0xFF; packet2[3] = 0xFF; packet2[4] = 0xFF; packet2[5] = 0xFF; 
  packet2[6] = 0x08; // Packet ID: 0x08 (End Data Packet - Gói kết thúc)
  packet2[7] = 0x01; packet2[8] = 0x02; 

  uint16_t checksum2 = packet2[6] + packet2[7] + packet2[8];
  for (int i = 0; i < 256; i++) {
    packet2[9 + i] = rawTemplate[256 + i];
    checksum2 += rawTemplate[256 + i];
  }
  packet2[265] = (checksum2 >> 8) & 0xFF;
  packet2[266] = checksum2 & 0xFF;

  serialPort_.write(packet2, sizeof(packet2));
  delay(50);
  while (serialPort_.available()) serialPort_.read();

  // 6. Ra lệnh cho cảm biến ghi dữ liệu từ CharBuffer 1 xuống bộ nhớ Flash
  uint8_t storeResult = fingerprint_.storeModel(id);
  if (storeResult != FINGERPRINT_OK) {
    Serial.println("[Fingerprint] Failed to store downloaded template to Flash.");
    return false;
  }

  Serial.printf("[Fingerprint] Successfully downloaded and stored template at ID #%d\n", id);
  return true;
}
}  // namespace tk::drivers
