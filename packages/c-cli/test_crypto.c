#include "cryptobin.h"

#include <assert.h>
#include <stdio.h>
#include <string.h>

int main(void) {
  char out[128];

  assert(base64url_encode((const uint8_t *)"hi", 2, out, sizeof(out)) == 0);
  assert(strcmp(out, "aGk") == 0);

  assert(base64url_encode((const uint8_t *)"hello", 5, out, sizeof(out)) == 0);
  assert(strcmp(out, "aGVsbG8") == 0);

  assert(json_escape("test", out, sizeof(out)) == 0);
  assert(strcmp(out, "\"test\"") == 0);

  assert(json_escape("a\"b\\c", out, sizeof(out)) == 0);
  assert(strcmp(out, "\"a\\\"b\\\\c\"") == 0);

  assert(json_escape("line\nbreak", out, sizeof(out)) == 0);
  assert(strcmp(out, "\"line\\u000abreak\"") == 0);

  printf("crypto ok\n");
  return 0;
}
