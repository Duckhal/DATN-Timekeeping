#pragma once

#include <Arduino.h>

namespace tk::config {
namespace gpio {
constexpr uint8_t kBootButtonPin = 0;
constexpr uint8_t kFingerprintRx = 16;
constexpr uint8_t kFingerprintTx = 17;

constexpr uint8_t kTftCs = 5;
constexpr uint8_t kTftRst = 4;
constexpr uint8_t kTftDc = 15;
constexpr uint8_t kTftMosi = 23;
constexpr uint8_t kTftSclk = 18;

constexpr uint8_t kRfidCs = 22;
constexpr uint8_t kRfidRst = 21;
constexpr uint8_t kRfidMiso = 27;
constexpr uint8_t kRfidMosi = 26;
constexpr uint8_t kRfidSck = 25;
}  // namespace gpio

namespace timing {
constexpr uint32_t kBootHoldToResetMs = 5000;
constexpr uint32_t kBootDebounceMs = 45;
constexpr uint32_t kBootShortPressMinMs = 40;
constexpr uint32_t kWifiConnectTimeoutMs = 10000;
constexpr uint32_t kRegisterIntervalMs = 60000;
constexpr uint32_t kMqttReconnectIntervalMs = 3000;
constexpr uint32_t kEnrollTimeoutMs = 30000;
constexpr uint32_t kFingerprintRetryIntervalMs = 5000;
constexpr uint32_t kSyncMappingRetryIntervalMs = 5000;
constexpr uint8_t kSyncMappingMaxAttempts = 3;
}  // namespace timing

namespace network {
constexpr const char* kDefaultSsid = "GalaxyA53";
constexpr const char* kDefaultPassword = "oysl4029";
constexpr const char* kDefaultServerIp = "192.168.255.16";
constexpr const char* kDefaultDeviceName = "ESP32-Timekeeping-Device";
constexpr uint16_t kDefaultServerPort = 3000;
constexpr uint16_t kMqttPort = 1883;
constexpr const char* kMqttBroadcastSyncTopic = "timekeeping/devices/sync-fingerprint";
constexpr const char* kApiBasePath = "/api";
constexpr const char* kRegisterEndpoint = "/devices/register";
constexpr const char* kFingerprintCallbackEndpoint = "/devices/fingerprint-callback";
constexpr const char* kSyncMappingCallbackEndpoint = "/devices/sync-mapping-callback";
constexpr const char* kCheckinEndpoint = "/devices/checkin";
constexpr const char* kFactoryResetEndpoint = "/devices/factory-reset";
constexpr const char* kSyncFingerprintEndpoint = "/devices/sync-fingerprint";
constexpr const char* kDeviceApiKey = "THIS_IS_A_STRONG_DEVICE_API_KEY_REPLACE_BEFORE_PRODUCTION";
}  // namespace network

namespace fingerprint {
constexpr uint16_t kMaxTemplateId = 1023;
constexpr uint32_t kBaudRate = 57600;
}  // namespace fingerprint

namespace portal {
constexpr const char* kDefaultPortalIp = "192.168.4.1";
constexpr const char* kPortalSsidPrefix = "ESP32-Timekeeping-";
}  // namespace portal
}  // namespace tk::config
