#pragma once

#include <Arduino.h>

namespace tk::models {
struct HttpResponse {
  bool ok;
  int statusCode;
  String body;
};
}  // namespace tk::models
