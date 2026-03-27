#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <Adafruit_Fingerprint.h>
#include <SPI.h>

// Screen pins (SPI)
#define TFT_CS    5
#define TFT_DC    15
#define TFT_RST   4

// Fingerprint sensor pins (UART2)
#define FP_RX 16
#define FP_TX 17

Adafruit_ST7789 tft = Adafruit_ST7789(TFT_CS, TFT_DC, TFT_RST);
// Use Serial2 for fingerprint sensor communication
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&Serial2);

void setup() {
  Serial.begin(115200);
  
  // 1. Initialize TFT display
  tft.init(240, 320);
  tft.invertDisplay(true);
  tft.setRotation(2);
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextColor(ST77XX_YELLOW);
  tft.setTextSize(2);
  tft.setCursor(10, 20);
  tft.println("Fingerprint System");

  // 2. Initialize fingerprint sensor
  Serial2.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
  if (finger.verifyPassword()) {
    tft.setTextColor(ST77XX_GREEN);
    tft.println("Sensor Found!");
  } else {
    tft.setTextColor(ST77XX_RED);
    tft.println("Sensor Not Found :(");
    while (1) { delay(1); }
  }
}

void loop() {
  uint8_t p = finger.getImage();
  
  if (p == FINGERPRINT_OK) {
    // 1. Send command to convert image to template (slot 1)
    p = finger.image2Tz(1);
    if (p != FINGERPRINT_OK) return;

    tft.fillScreen(ST77XX_BLACK);
    tft.setCursor(10, 20);
    tft.setTextColor(ST77XX_CYAN);
    tft.println("Fetching Template...");

    // 2. Send command to get model
    p = finger.getModel();
    if (p == FINGERPRINT_OK) {
      Serial.println("\n--- FINGERPRINT TEMPLATE START ---");
      Serial.print("HEX: ");

      tft.setCursor(0, 50);
      tft.setTextColor(ST77XX_WHITE);
      tft.setTextSize(1);

      uint16_t count = 0;
      uint32_t startTime = millis();

      // Read bytes from Serial2 for a certain duration or until we get 512 bytes (fingerprint template size)
      while ((count < 512) && ((millis() - startTime) < 1500)) {
        if (Serial2.available()) {
          uint8_t b = Serial2.read();
          
          // Print byte in HEX format to Serial
          if (b < 0x10) Serial.print("0");
          Serial.print(b, HEX);
          
          // Display a portion on the TFT screen for verification
          if (count < 120) {
            if (b < 0x10) tft.print("0");
            tft.print(b, HEX);
            tft.print(" ");
          }
          
          count++;
        }
      }
      Serial.println("\n--- FINGERPRINT TEMPLATE END ---");
      Serial.printf("Total bytes received: %d\n", count);

      tft.setCursor(10, 280);
      tft.setTextColor(ST77XX_GREEN);
      tft.printf("Done: %d bytes", count);
    } else {
      Serial.println("Error: Could not get model from sensor.");
      tft.setTextColor(ST77XX_RED);
      tft.println("Error getModel");
    }

    delay(5000); 
    tft.fillScreen(ST77XX_BLACK);
    tft.setCursor(10, 20);
    tft.setTextColor(ST77XX_YELLOW);
    tft.println("Ready to scan...");
  }
}