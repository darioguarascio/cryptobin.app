#include "cryptobin.h"

#include <ctype.h>
#include <openssl/bio.h>
#include <openssl/buffer.h>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int base64url_encode(const uint8_t *in, size_t in_len, char *out, size_t out_cap) {
  if (!in || !out || out_cap == 0) {
    return -1;
  }

  BIO *b64 = BIO_new(BIO_f_base64());
  BIO *mem = BIO_new(BIO_s_mem());
  if (!b64 || !mem) {
    BIO_free_all(b64);
    BIO_free_all(mem);
    return -1;
  }

  BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
  BIO_push(b64, mem);
  if (BIO_write(b64, in, (int)in_len) < 0) {
    BIO_free_all(b64);
    return -1;
  }
  if (BIO_flush(b64) != 1) {
    BIO_free_all(b64);
    return -1;
  }

  BUF_MEM *buf = NULL;
  BIO_get_mem_ptr(b64, &buf);
  if (!buf || buf->length + 1 > out_cap) {
    BIO_free_all(b64);
    return -1;
  }

  memcpy(out, buf->data, buf->length);
  out[buf->length] = '\0';
  for (size_t i = 0; out[i]; i++) {
    if (out[i] == '+') {
      out[i] = '-';
    } else if (out[i] == '/') {
      out[i] = '_';
    }
  }
  while (out[0] && out[strlen(out) - 1] == '=') {
    out[strlen(out) - 1] = '\0';
  }

  BIO_free_all(b64);
  return 0;
}

int json_escape(const char *in, char *out, size_t out_cap) {
  if (!in || !out || out_cap < 3) {
    return -1;
  }

  size_t w = 0;
  out[w++] = '"';
  for (size_t i = 0; in[i]; i++) {
    unsigned char c = (unsigned char)in[i];
    char chunk[7];

    if (c == '"' || c == '\\') {
      if (w + 2 >= out_cap) {
        return -1;
      }
      out[w++] = '\\';
      out[w++] = (char)c;
      continue;
    }
    if (c < 0x20) {
      if (w + 6 >= out_cap) {
        return -1;
      }
      snprintf(chunk, sizeof(chunk), "\\u%04x", c);
      memcpy(out + w, chunk, 6);
      w += 6;
      continue;
    }
    if (w + 1 >= out_cap) {
      return -1;
    }
    out[w++] = (char)c;
  }
  if (w + 1 >= out_cap) {
    return -1;
  }
  out[w++] = '"';
  out[w] = '\0';
  return 0;
}

static int append_metadata_field(
  char *json,
  size_t *pos,
  size_t cap,
  const char *key,
  const char *value,
  int *first) {
  char escaped[CRYPTOBIN_METADATA_ESCAPED];

  if (!value || !value[0]) {
    return 0;
  }
  if (json_escape(value, escaped, sizeof(escaped)) != 0) {
    return -1;
  }
  int n = snprintf(
    json + *pos,
    cap - *pos,
    "%s\"%s\":%s",
    *first ? "" : ",",
    key,
    escaped);
  if (n < 0 || (size_t)n >= cap - *pos) {
    return -1;
  }
  *pos += (size_t)n;
  *first = 0;
  return 0;
}

static int ttl_key_bits(int ttl_hours, int *key_bits, const char **algorithm) {
  if (ttl_hours <= 1) {
    *key_bits = 128;
    *algorithm = "AES-GCM-128";
    return 0;
  }
  if (ttl_hours == 24 || ttl_hours == 72 || ttl_hours == 168) {
    *key_bits = 256;
    *algorithm = "AES-GCM-256";
    return 0;
  }
  return -1;
}

static int aes_gcm_encrypt(
  const uint8_t *key,
  size_t key_len,
  const uint8_t *plain,
  size_t plain_len,
  uint8_t *out,
  size_t *out_len) {
  EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
  if (!ctx) {
    return -1;
  }

  const EVP_CIPHER *cipher =
    key_len == 16 ? EVP_aes_128_gcm() : key_len == 32 ? EVP_aes_256_gcm() : NULL;
  if (!cipher) {
    EVP_CIPHER_CTX_free(ctx);
    return -1;
  }

  uint8_t iv[12];
  if (RAND_bytes(iv, sizeof(iv)) != 1) {
    EVP_CIPHER_CTX_free(ctx);
    return -1;
  }

  int len = 0;
  int total = 0;
  if (EVP_EncryptInit_ex(ctx, cipher, NULL, NULL, NULL) != 1) {
    EVP_CIPHER_CTX_free(ctx);
    return -1;
  }
  if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, 12, NULL) != 1) {
    EVP_CIPHER_CTX_free(ctx);
    return -1;
  }
  if (EVP_EncryptInit_ex(ctx, NULL, NULL, key, iv) != 1) {
    EVP_CIPHER_CTX_free(ctx);
    return -1;
  }
  if (EVP_EncryptUpdate(ctx, out + 12, &len, plain, (int)plain_len) != 1) {
    EVP_CIPHER_CTX_free(ctx);
    return -1;
  }
  total = 12 + len;
  if (EVP_EncryptFinal_ex(ctx, out + total, &len) != 1) {
    EVP_CIPHER_CTX_free(ctx);
    return -1;
  }
  total += len;

  uint8_t tag[16];
  if (EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, 16, tag) != 1) {
    EVP_CIPHER_CTX_free(ctx);
    return -1;
  }
  memcpy(out, iv, 12);
  memcpy(out + total, tag, 16);
  *out_len = (size_t)total + 16;
  EVP_CIPHER_CTX_free(ctx);
  return 0;
}

static size_t json_escape_worst_cap(size_t in_len) {
  return in_len * 6 + 4;
}

static size_t b64url_cap(size_t raw_len) {
  return ((raw_len + 2) / 3) * 4 + 8;
}

int encrypt_and_upload_secret(
  const char *body,
  const secret_opts_t *opts,
  secret_result_t *result,
  char *err,
  size_t err_cap) {
  if (!body || !opts || !result || !err || err_cap == 0) {
    return -1;
  }

  size_t body_len = strlen(body);
  if (body_len > CRYPTOBIN_MAX_SECRET) {
    snprintf(err, err_cap, "Secret is too large (max 4 MiB)");
    return -1;
  }

  int key_bits = 0;
  const char *algorithm = NULL;
  if (ttl_key_bits(opts->ttl_hours, &key_bits, &algorithm) != 0) {
    snprintf(err, err_cap, "TTL must be one of: 1, 24, 72, 168");
    return -1;
  }

  size_t key_len = (size_t)(key_bits / 8);
  uint8_t key[32];
  if (RAND_bytes(key, (int)key_len) != 1) {
    snprintf(err, err_cap, "Failed to generate encryption key");
    return -1;
  }

  size_t escaped_cap = json_escape_worst_cap(body_len);
  char *escaped_body = malloc(escaped_cap);
  char *inner = NULL;
  uint8_t *cipher_buf = NULL;
  char *ct_b64 = NULL;
  char *request = NULL;
  int rc = -1;

  if (!escaped_body) {
    snprintf(err, err_cap, "Out of memory");
    goto cleanup;
  }

  if (json_escape(body, escaped_body, escaped_cap) != 0) {
    snprintf(err, err_cap, "Secret is too large to encode");
    goto cleanup;
  }

  size_t inner_cap = escaped_cap + 512;
  inner = malloc(inner_cap);
  if (!inner) {
    snprintf(err, err_cap, "Out of memory");
    goto cleanup;
  }

  size_t pos = 0;
  int first = 1;
  int n = snprintf(inner, inner_cap, "{\"body\":%s,\"metadata\":{", escaped_body);
  if (n < 0 || (size_t)n >= inner_cap) {
    snprintf(err, err_cap, "Failed to build secret payload");
    goto cleanup;
  }
  pos = (size_t)n;
  if (append_metadata_field(inner, &pos, inner_cap, "from", opts->from, &first) != 0 ||
      append_metadata_field(inner, &pos, inner_cap, "label", opts->label, &first) != 0 ||
      append_metadata_field(inner, &pos, inner_cap, "description", opts->description, &first) != 0) {
    snprintf(err, err_cap, "Metadata is too large");
    goto cleanup;
  }
  if (pos + 2 >= inner_cap) {
    snprintf(err, err_cap, "Failed to build secret payload");
    goto cleanup;
  }
  inner[pos++] = '}';
  inner[pos++] = '}';
  inner[pos] = '\0';

  size_t plain_len = pos;
  size_t cipher_cap = plain_len + 32;
  cipher_buf = malloc(cipher_cap);
  if (!cipher_buf) {
    snprintf(err, err_cap, "Out of memory");
    goto cleanup;
  }

  size_t cipher_len = 0;
  if (aes_gcm_encrypt(key, key_len, (const uint8_t *)inner, plain_len, cipher_buf, &cipher_len) != 0) {
    snprintf(err, err_cap, "Encryption failed");
    goto cleanup;
  }

  char iv_b64[32];
  char key_b64[128];
  size_t ct_cap = b64url_cap(cipher_len);
  ct_b64 = malloc(ct_cap);
  if (!ct_b64) {
    snprintf(err, err_cap, "Out of memory");
    goto cleanup;
  }

  if (base64url_encode(cipher_buf, 12, iv_b64, sizeof(iv_b64)) != 0 ||
      base64url_encode(cipher_buf + 12, cipher_len - 12, ct_b64, ct_cap) != 0 ||
      base64url_encode(key, key_len, key_b64, sizeof(key_b64)) != 0) {
    snprintf(err, err_cap, "Encoding failed");
    goto cleanup;
  }

  size_t request_cap = ct_cap + 4096;
  request = malloc(request_cap);
  if (!request) {
    snprintf(err, err_cap, "Out of memory");
    goto cleanup;
  }

  pos = 0;
  first = 1;
  n = snprintf(
    request,
    request_cap,
    "{\"version\":1,\"algorithm\":\"%s\",\"iv\":\"%s\",\"ciphertext\":\"%s\",\"ttlHours\":%d",
    algorithm,
    iv_b64,
    ct_b64,
    opts->ttl_hours);
  if (n < 0 || (size_t)n >= request_cap) {
    snprintf(err, err_cap, "Failed to build upload JSON");
    goto cleanup;
  }
  pos = (size_t)n;

  if (opts->from || opts->label || opts->description) {
    n = snprintf(request + pos, request_cap - pos, ",\"metadataPreview\":{");
    if (n < 0 || (size_t)n >= request_cap - pos) {
      snprintf(err, err_cap, "Failed to build upload JSON");
      goto cleanup;
    }
    pos += (size_t)n;
    first = 1;
    if (append_metadata_field(request, &pos, request_cap, "from", opts->from, &first) != 0 ||
        append_metadata_field(request, &pos, request_cap, "label", opts->label, &first) != 0 ||
        append_metadata_field(request, &pos, request_cap, "description", opts->description, &first) != 0) {
      snprintf(err, err_cap, "Metadata is too large");
      goto cleanup;
    }
    if (pos + 1 >= request_cap) {
      snprintf(err, err_cap, "Failed to build upload JSON");
      goto cleanup;
    }
    request[pos++] = '}';
  }

  if (pos + 2 >= request_cap) {
    snprintf(err, err_cap, "Failed to build upload JSON");
    goto cleanup;
  }
  request[pos++] = '}';
  request[pos] = '\0';

  char base_url[CRYPTOBIN_MAX_URL];
  if (resolve_base_url(opts->base_url, base_url, sizeof(base_url)) != 0) {
    snprintf(err, err_cap, "Invalid server URL");
    goto cleanup;
  }

  if (post_secret_json(base_url, request, result->id, sizeof(result->id), err, err_cap) != 0) {
    goto cleanup;
  }

  snprintf(result->key_b64, sizeof(result->key_b64), "%s", key_b64);
  snprintf(result->url, sizeof(result->url), "%s/s/%s#%s", base_url, result->id, key_b64);
  rc = 0;

cleanup:
  free(request);
  free(ct_b64);
  free(cipher_buf);
  free(inner);
  free(escaped_body);
  return rc;
}

int generate_stream_key(uint8_t *key_out, char *key_b64, size_t key_b64_cap) {
  if (!key_out || !key_b64) {
    return -1;
  }
  if (RAND_bytes(key_out, CRYPTOBIN_STREAM_KEY_BYTES) != 1) {
    return -1;
  }
  return base64url_encode(key_out, CRYPTOBIN_STREAM_KEY_BYTES, key_b64, key_b64_cap);
}

int encrypt_stream_frame(
  const uint8_t key[CRYPTOBIN_STREAM_KEY_BYTES],
  const uint8_t *plain,
  size_t plain_len,
  char *iv_b64,
  size_t iv_cap,
  char *ct_b64,
  size_t ct_cap) {
  if (!key || !plain || !iv_b64 || !ct_b64) {
    return -1;
  }

  size_t cipher_cap = plain_len + 32;
  uint8_t *cipher_buf = malloc(cipher_cap);
  if (!cipher_buf) {
    return -1;
  }

  size_t cipher_len = 0;
  if (aes_gcm_encrypt(key, CRYPTOBIN_STREAM_KEY_BYTES, plain, plain_len, cipher_buf, &cipher_len) != 0) {
    free(cipher_buf);
    return -1;
  }

  int rc = -1;
  if (base64url_encode(cipher_buf, 12, iv_b64, iv_cap) == 0 &&
      base64url_encode(cipher_buf + 12, cipher_len - 12, ct_b64, ct_cap) == 0) {
    rc = 0;
  }

  free(cipher_buf);
  return rc;
}
