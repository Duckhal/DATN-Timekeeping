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
