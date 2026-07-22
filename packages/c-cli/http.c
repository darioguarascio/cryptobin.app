#include "cryptobin.h"

#include <curl/curl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  char *data;
  size_t len;
} mem_buf_t;

static size_t write_cb(void *contents, size_t size, size_t nmemb, void *userp) {
  size_t total = size * nmemb;
  mem_buf_t *buf = userp;
  char *next = realloc(buf->data, buf->len + total + 1);
  if (!next) {
    return 0;
  }
  buf->data = next;
  memcpy(buf->data + buf->len, contents, total);
  buf->len += total;
  buf->data[buf->len] = '\0';
  return total;
}

static int extract_json_string(const char *json, const char *key, char *out, size_t out_cap) {
  char pattern[64];
  snprintf(pattern, sizeof(pattern), "\"%s\":\"", key);
  const char *start = strstr(json, pattern);
  if (!start) {
    return -1;
  }
  start += strlen(pattern);
  const char *end = start;
  while (*end && *end != '"') {
    if (*end == '\\' && end[1]) {
      end += 2;
      continue;
    }
    end++;
  }
  size_t len = (size_t)(end - start);
  if (len + 1 > out_cap) {
    return -1;
  }
  memcpy(out, start, len);
  out[len] = '\0';
  return 0;
}

static int extract_json_error(const char *json, char *err, size_t err_cap) {
  if (extract_json_string(json, "error", err, err_cap) == 0) {
    return 0;
  }
  snprintf(err, err_cap, "Upload failed");
  return -1;
}

int post_secret_json(
  const char *base_url,
  const char *json_body,
  char *id_out,
  size_t id_cap,
  char *err,
  size_t err_cap) {
  if (!base_url || !json_body || !id_out || !err) {
    return -1;
  }

  char url[CRYPTOBIN_MAX_URL + 32];
  snprintf(url, sizeof(url), "%s/api/secrets", base_url);

  mem_buf_t response = {0};
  CURL *curl = curl_easy_init();
  if (!curl) {
    snprintf(err, err_cap, "Failed to initialize HTTP client");
    return -1;
  }

  struct curl_slist *headers = NULL;
  headers = curl_slist_append(headers, "Content-Type: application/json");

  curl_easy_setopt(curl, CURLOPT_URL, url);
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_body);
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_cb);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "cryptobin-c-cli/0.1");

  CURLcode code = curl_easy_perform(curl);
  long status = 0;
  curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &status);

  curl_slist_free_all(headers);
  curl_easy_cleanup(curl);

  if (code != CURLE_OK) {
    snprintf(err, err_cap, "HTTP request failed: %s", curl_easy_strerror(code));
    free(response.data);
    return -1;
  }

  if (status < 200 || status >= 300) {
    if (response.data) {
      extract_json_error(response.data, err, err_cap);
    } else {
      snprintf(err, err_cap, "Upload failed (%ld)", status);
    }
    free(response.data);
    return -1;
  }

  if (!response.data || extract_json_string(response.data, "id", id_out, id_cap) != 0) {
    snprintf(err, err_cap, "Invalid server response");
    free(response.data);
    return -1;
  }

  free(response.data);
  return 0;
}
