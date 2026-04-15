#pragma once

#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <Arduino.h>
#include <SPI.h>

class DisplayManager {
 public:
  static constexpr uint8_t TFT_CS = 5;
  static constexpr uint8_t TFT_RST = 4;
  static constexpr uint8_t TFT_DC = 15;
  static constexpr uint8_t TFT_MOSI = 23;
  static constexpr uint8_t TFT_SCLK = 18;

  void begin();
  void clearScreen(uint16_t color = ST77XX_BLACK);
  void showNotConnected(const String &apSsid, const String &portalIp);
  void showServerConnectionFailed(int httpStatusCode);
  void showConnectedSuccessfully();
  void showInactiveMode();
  void showMaintenanceMode();
  void showNotifyingServer();
  void showDeviceDeletedFactoryResetting();
  void showWelcome();
  void showSettingsCleared();

 private:
  Adafruit_ST7789 tft_ = Adafruit_ST7789(TFT_CS, TFT_DC, TFT_RST);

  void drawCenteredText(const String &text, int16_t y, uint16_t color, uint8_t textSize);
};
