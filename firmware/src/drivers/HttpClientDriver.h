#pragma once

#include <Arduino.h>

#include "models/HttpResponse.h"

namespace tk::drivers {
class HttpClientDriver {
 public:
  models::HttpResponse postJson(const String& url,
                                const String& payload,
                                const String& bearerToken = "",
                                uint32_t timeoutMs = 0) const;

  models::HttpResponse getJson(const String& url,
                               const String& bearerToken = "",
                               uint32_t timeoutMs = 0) const;
};
}  // namespace tk::drivers
