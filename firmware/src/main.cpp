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

