#pragma once

#include <Arduino.h>
#include <WebServer.h>
#include <functional>

#include "models/DeviceConfig.h"

namespace tk::drivers {
class PortalDriver {
 public:
  using SaveHandler = std::function<void(const models::DeviceConfig& config)>;

  explicit PortalDriver(uint16_t port = 80);

  void begin(const SaveHandler& saveHandler);
  void handleClient();
  bool isRunning() const;

 private:
  String renderHtml() const;
  void handleRoot();
  void handleSave();

  WebServer server_;
  SaveHandler onSave_;
  bool isRunning_ = false;
};
}  // namespace tk::drivers
