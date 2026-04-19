#include "drivers/HttpClientDriver.h"

#include <HTTPClient.h>

namespace tk::drivers {
models::HttpResponse HttpClientDriver::postJson(const String& url,
                                                const String& payload,
                                                const String& bearerToken,
                                                uint32_t timeoutMs) const {
  HTTPClient http;

  if (timeoutMs > 0) {
    http.setTimeout(timeoutMs);
  }

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  if (bearerToken.length() > 0) {
    http.addHeader("Authorization", bearerToken);
  }

  const int statusCode = http.POST(payload);
  const String body = http.getString();
  http.end();

  return {
      statusCode >= 200 && statusCode < 300,
      statusCode,
      body,
  };
}
}  // namespace tk::drivers
