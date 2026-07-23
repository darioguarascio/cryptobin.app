#ifndef CRYPTOBIN_H
#define CRYPTOBIN_H

#include <stddef.h>
#include <stdint.h>

#define CRYPTOBIN_DEFAULT_URL "https://cryptobin.app"
#define CRYPTOBIN_MAX_URL 512
#define CRYPTOBIN_MAX_SECRET (4 * 1024 * 1024)
#define CRYPTOBIN_METADATA_ESCAPED 2048
#define CRYPTOBIN_MAX_LINE 8192
#define CRYPTOBIN_STREAM_KEY_BYTES 32
#define CRYPTOBIN_MAX_STREAM_FRAME (64 * 1024)

typedef struct {
  int ttl_hours;
  const char *from;
  const char *label;
  const char *description;
  const char *base_url;
} secret_opts_t;

typedef struct {
  int ttl_hours;
  const char *label;
  const char *base_url;
} stream_opts_t;

typedef struct {
  char id[128];
  char key_b64[128];
  char url[1024];
} secret_result_t;

int base64url_encode(const uint8_t *in, size_t in_len, char *out, size_t out_cap);
int json_escape(const char *in, char *out, size_t out_cap);
int resolve_base_url(const char *flag_url, char *out, size_t out_cap);
int resolve_api_base_url(const char *public_url, char *out, size_t out_cap);
int resolve_api_vhost(const char *public_url, char *out, size_t out_cap);
int load_config_url(char *out, size_t out_cap);
int save_config_url(const char *url);

int extract_json_string(const char *json, const char *key, char *out, size_t out_cap);

int post_secret_json(
  const char *base_url,
  const char *json_body,
  char *id_out,
  size_t id_cap,
  char *err,
  size_t err_cap);

int encrypt_and_upload_secret(
  const char *body,
  const secret_opts_t *opts,
  secret_result_t *result,
  char *err,
  size_t err_cap);

int generate_stream_key(uint8_t *key_out, char *key_b64, size_t key_b64_cap);
int encrypt_stream_frame(
  const uint8_t key[CRYPTOBIN_STREAM_KEY_BYTES],
  const uint8_t *plain,
  size_t plain_len,
  char *iv_b64,
  size_t iv_cap,
  char *ct_b64,
  size_t ct_cap);

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
  size_t err_cap);

int post_stream_payload(
  const char *api_base_url,
  const char *public_base_url,
  const char *stream_id,
  const char *producer_token,
  const char *json_body,
  char *err,
  size_t err_cap);

int run_stream(int argc, char **argv, int start);

extern int cryptobin_cli_verbose;

void cryptobin_print_usage(const char *argv0);

#endif
