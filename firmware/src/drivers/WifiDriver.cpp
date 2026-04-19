#include "drivers/WifiDriver.h"

namespace tk::drivers {
bool WifiDriver::connectStation(const String& ssid, const String& password, uint32_t timeoutMs) {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());

  const uint32_t startedAt = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - startedAt >= timeoutMs) {
      return false;
    }
    delay(250);
  }

  return true;
}

void WifiDriver::startAccessPoint(const String& ssid) {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ssid.c_str());
}

wl_status_t WifiDriver::status() const {
  return WiFi.status();
}

String WifiDriver::localIpAddress() const {
  return WiFi.localIP().toString();
}

String WifiDriver::apIpAddress() const {
  return WiFi.softAPIP().toString();
}

String WifiDriver::macAddress() const {
  return WiFi.macAddress();
}
}  // namespace tk::drivers
