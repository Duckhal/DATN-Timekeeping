#include "app/App.h"

namespace {
tk::app::App app;
}

void setup() {
  app.begin();
}

void loop() {
  app.tick();
}

// #include <Arduino.h>

// // Định nghĩa chân điều khiển Buzzer theo sơ đồ cấu hình của bạn
// constexpr uint8_t kBuzzerPin = 12;

// /**
//  * ÂM THANH 1: Chấm công THÀNH CÔNG (Success)
//  * Quy chuẩn: Kêu 2 tiếng "Tít! Tít!" ngắn, dứt khoát.
//  */
// void playSuccessSound() {
//   Serial.println("[BUZZER] Phát âm thanh: CHẤM CÔNG THÀNH CÔNG (Tít! Tít!)");
  
//   digitalWrite(kBuzzerPin, HIGH); // Bật còi (Mức cao kích dẫn)
//   delay(80);                      // Kêu ngắn 80ms
//   digitalWrite(kBuzzerPin, LOW);  // Tắt còi
//   delay(80);                      // Khoảng nghỉ giữa 2 tiếng 80ms
  
//   digitalWrite(kBuzzerPin, HIGH); // Bật còi lần 2
//   delay(80);                      // Kêu ngắn 80ms
//   digitalWrite(kBuzzerPin, LOW);  // Tắt hẳn
// }

// /**
//  * ÂM THANH 2: Chấm công THẤT BẠI / CẢNH BÁO (Error)
//  * Quy chuẩn: Kêu 1 tiếng "TÍIIIIIT" kéo dài nặng nề.
//  */
// void playErrorSound() {
//   Serial.println("[BUZZER] Phát âm thanh: CHẤM CÔNG THẤT BẠI (TÍIIIIIT)");
  
//   digitalWrite(kBuzzerPin, HIGH); // Bật còi
//   delay(600);                     // Kéo dài liên tục 600ms để cảnh báo
//   digitalWrite(kBuzzerPin, LOW);  // Tắt hẳn
// }

// void setup() {
//   // Khởi tạo Serial Monitor để theo dõi trạng thái log
//   Serial.begin(115200);
//   delay(1000);
//   Serial.println("\n--- BẮT ĐẦU TEST ACTIVE BUZZER (HIGH LEVEL TRIGGER) ---");

//   // Cấu hình chân GPIO 12 là OUTPUT
//   pinMode(kBuzzerPin, OUTPUT);
  
//   // Đảm bảo còi tắt ngay khi vừa khởi động mạch
//   digitalWrite(kBuzzerPin, LOW); 
//   Serial.println("[SETUP] Đã cấu hình GPIO 12 làm chân kích mức cao.");
// }

// void loop() {
//   // 1. Test âm thanh Thành công
//   playSuccessSound();
  
//   // Chờ 3 giây
//   delay(3000);
  
//   // 2. Test âm thanh Thất bại
//   playErrorSound();
  
//   // Chờ 3 giây trước khi lặp lại vòng lặp
//   delay(3000);
// }

// --- RFID raw UID test (temporary) ---
// Uncomment this block and comment out the App code above when you want to
// test RC522 wiring/pins. It logs raw UID bytes to Serial.
// #include <Arduino.h>
// #include <SPI.h>
// #include <MFRC522.h>

// constexpr uint8_t kRfidCs = 22;
// constexpr uint8_t kRfidRst = 21;
// constexpr uint8_t kRfidMiso = 27;
// constexpr uint8_t kRfidMosi = 26;
// constexpr uint8_t kRfidSck = 25;

// MFRC522 mfrc522(kRfidCs, kRfidRst);

// void setup() {
//   Serial.begin(115200);
  
//   // ĐIỂM MẤU CHỐT: Ép ESP32 dùng đúng bộ chân SPI của bạn
//   SPI.begin(kRfidSck, kRfidMiso, kRfidMosi, kRfidCs); 
  
//   mfrc522.PCD_Init(); 

//   Serial.println("\n--- TEST KET NOI RC522 (CUSTOM PINS) ---");
  
//   byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
//   Serial.print("Firmware Version: 0x");
//   Serial.println(version, HEX);

//   if (version == 0x00 || version == 0xFF) {
//     Serial.println("[LOI] Khong tim thay RC522. Kiem tra lai day jumper (co the bi long/dut ngam)!");
//   } else {
//     Serial.println("[OK] Giao tiep SPI thanh cong. Hay thu quet the nhe!");
//   }
// }

// void loop() {
//   if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
//     Serial.print("Tim thay the! UID (Hex): ");
//     for (byte i = 0; i < mfrc522.uid.size; i++) {
//       if (mfrc522.uid.uidByte[i] < 0x10) Serial.print("0");
//       Serial.print(mfrc522.uid.uidByte[i], HEX);
//     }
//     Serial.println();
//     mfrc522.PICC_HaltA(); 
//   }
// }

// #include <Arduino.h>
// #include <Adafruit_Fingerprint.h>
// #include "Config/Config.h"

// // Khởi tạo Serial2 cho ESP32
// HardwareSerial mySerial(2);
// Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

// void setup() {
//   Serial.begin(115200);
//   delay(1000);
  
//   Serial.println("\n===========================================");
//   Serial.println("   TOOL XOA DU LIEU CAM BIEN VAN TAY");
//   Serial.println("===========================================");

//   // Khởi tạo giao tiếp UART với module vân tay (Sử dụng cấu hình từ Config.h)
//   mySerial.begin(tk::config::fingerprint::kBaudRate, SERIAL_8N1, 
//                  tk::config::gpio::kFingerprintRx, 
//                  tk::config::gpio::kFingerprintTx);
//   finger.begin(tk::config::fingerprint::kBaudRate);

//   // Kiểm tra kết nối
//   if (finger.verifyPassword()) {
//     Serial.println("[OK] Tim thay module van tay!");
//   } else {
//     Serial.println("[ERROR] Khong tim thay module! Kiem tra lai day RX/TX.");
//     while (1) { delay(1); } // Dừng chương trình nếu không thấy cảm biến
//   }

//   Serial.println("Dang tien hanh xoa TOAN BO du lieu (PS_Empty)...");
  
//   // Gọi hàm xóa toàn bộ bộ nhớ flash của cảm biến
//   uint8_t result = finger.emptyDatabase();

//   if (result == FINGERPRINT_OK) {
//     Serial.println("[SUCCESS] Da xoa sach toan bo template van tay!");
//     Serial.println("Bay gio ban co the nap lai code app chinh de tiep tuc test.");
//   } else {
//     Serial.print("[FAILED] Xoa that bai! Ma loi: 0x");
//     Serial.println(result, HEX);
//   }
// }

// void loop() {
//   // Tool chỉ chạy 1 lần trong setup, vòng lặp loop để trống
//   delay(1000);
// }

