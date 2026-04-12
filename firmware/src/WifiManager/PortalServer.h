#pragma once

#include <Arduino.h>
#include <WebServer.h>
#include <functional>

#include "ConfigStore.h"

class PortalServer {
 public:
  using SaveHandler = std::function<void(const DeviceConfig &config)>;

  explicit PortalServer(uint16_t port = 80);

  void begin(const SaveHandler &saveHandler);
  void handleClient();
  bool isRunning() const;

 private:
  WebServer server_;
  SaveHandler onSave_;
  bool isRunning_ = false;

  String renderHtml() const;
  void handleRoot();
  void handleSave();
};
