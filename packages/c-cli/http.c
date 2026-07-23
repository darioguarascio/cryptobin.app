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

int extract_json_string(const char *json, const char *key, char *out, size_t out_cap) {
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

static int host_from_url(const char *url, char *out, size_t out_cap) {
  const char *p = url;
  if (strncmp(p, "https://", 8) == 0) {
    p += 8;
  } else if (strncmp(p, "http://", 7) == 0) {
    p += 7;
  } else {
    return -1;
  }
  size_t i = 0;
  while (p[i] && p[i] != '/' && p[i] != '?' && p[i] != '#') {
    if (i + 1 >= out_cap) {
      return -1;
    }
    out[i] = p[i];
    i++;
  }
  if (i == 0) {
    return -1;
  }
  out[i] = '\0';
  char *colon = strchr(out, ':');
  if (colon) {
    *colon = '\0';
  }
  return 0;
}

static struct curl_slist *append_api_host_header(
  struct curl_slist *headers,
  const char *request_url,
  const char *public_base_url) {
  char vhost[256];
  if (resolve_api_vhost(public_base_url, vhost, sizeof(vhost)) != 0) {
    return headers;
  }
  char req_host[256];
  if (host_from_url(request_url, req_host, sizeof(req_host)) != 0) {
    return headers;
  }
  if (strcmp(req_host, vhost) == 0) {
    return headers;
  }
  char line[320];
  snprintf(line, sizeof(line), "Host: %s", vhost);
  return curl_slist_append(headers, line);
}

static void format_http_status_error(long status, const char *body, char *err, size_t err_cap) {
  if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
    snprintf(
      err,
      err_cap,
      "API login redirect (HTTP %ld). Set CRYPTOBIN_API_URL to your internal API base URL and CRYPTOBIN_API_HOST to the public site hostname",
      status);
    return;
  }
  if (body && body[0] == '<') {
    snprintf(err, err_cap, "Unexpected HTML response (HTTP %ld)", status);
    return;
  }
  if (body && extract_json_string(body, "error", err, err_cap) == 0) {
    return;
  }
  snprintf(err, err_cap, "Upload failed (HTTP %ld)", status);
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

int post_stream_json(
  const char *api_base_url,
  const char *public_base_url,
  int ttl_hours,
  const char *label,
  char *id_out,
  size_t id_cap,
  char *token_out,
  size_t token_cap,
  char *err,
  size_t err_cap) {
  if (!api_base_url || !id_out || !token_out || !err) {
    return -1;
  }

  char body[4096];
  size_t pos = 0;
  int n = snprintf(body, sizeof(body), "{\"ttlHours\":%d", ttl_hours);
  if (n < 0 || (size_t)n >= sizeof(body)) {
    snprintf(err, err_cap, "Failed to build stream request");
    return -1;
  }
  pos = (size_t)n;

  if (label && label[0]) {
    char escaped[CRYPTOBIN_METADATA_ESCAPED];
    if (json_escape(label, escaped, sizeof(escaped)) != 0) {
      snprintf(err, err_cap, "Label is too large");
      return -1;
    }
    n = snprintf(body + pos, sizeof(body) - pos, ",\"label\":%s", escaped);
    if (n < 0 || (size_t)n >= sizeof(body) - pos) {
      snprintf(err, err_cap, "Failed to build stream request");
      return -1;
    }
    pos += (size_t)n;
  }

  if (pos + 2 >= sizeof(body)) {
    snprintf(err, err_cap, "Failed to build stream request");
    return -1;
  }
  body[pos++] = '}';
  body[pos] = '\0';

  char url[CRYPTOBIN_MAX_URL + 32];
  snprintf(url, sizeof(url), "%s/api/streams", api_base_url);

  mem_buf_t response = {0};
  CURL *curl = curl_easy_init();
  if (!curl) {
    snprintf(err, err_cap, "Failed to initialize HTTP client");
    return -1;
  }

  struct curl_slist *headers = NULL;
  headers = curl_slist_append(headers, "Content-Type: application/json");
  if (public_base_url && public_base_url[0]) {
    headers = append_api_host_header(headers, url, public_base_url);
  }

  curl_easy_setopt(curl, CURLOPT_URL, url);
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body);
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_cb);
  curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "cryptobin-c-cli/0.1");
  curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 0L);

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
    format_http_status_error(status, response.data, err, err_cap);
    free(response.data);
    return -1;
  }

  if (!response.data ||
      extract_json_string(response.data, "id", id_out, id_cap) != 0 ||
      extract_json_string(response.data, "producerToken", token_out, token_cap) != 0) {
    snprintf(err, err_cap, "Invalid server response");
    free(response.data);
    return -1;
  }

  free(response.data);
  return 0;
}

int post_stream_payload(
  const char *api_base_url,
  const char *public_base_url,
  const char *stream_id,
  const char *producer_token,
  const char *json_body,
  char *err,
  size_t err_cap) {
  if (!api_base_url || !stream_id || !producer_token || !json_body || !err) {
    return -1;
  }

  char url[CRYPTOBIN_MAX_URL + 128];
  snprintf(url, sizeof(url), "%s/api/streams/%s/frames", api_base_url, stream_id);

  char auth_header[512];
  snprintf(auth_header, sizeof(auth_header), "Authorization: Bearer %s", producer_token);

  CURL *curl = curl_easy_init();
  if (!curl) {
    snprintf(err, err_cap, "Failed to initialize HTTP client");
    return -1;
  }

  struct curl_slist *headers = NULL;
  headers = curl_slist_append(headers, "Content-Type: application/json");
  headers = curl_slist_append(headers, auth_header);
  if (public_base_url && public_base_url[0]) {
    headers = append_api_host_header(headers, url, public_base_url);
  }

  curl_easy_setopt(curl, CURLOPT_URL, url);
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_body);
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
  curl_easy_setopt(curl, CURLOPT_USERAGENT, "cryptobin-c-cli/0.1");
  curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 0L);

  CURLcode code = curl_easy_perform(curl);
  long status = 0;
  curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &status);

  curl_slist_free_all(headers);
  curl_easy_cleanup(curl);

  if (code != CURLE_OK) {
    snprintf(err, err_cap, "HTTP request failed: %s", curl_easy_strerror(code));
    return -1;
  }

  if (status == 204) {
    return 0;
  }

  format_http_status_error(status, NULL, err, err_cap);
  return -1;
}
