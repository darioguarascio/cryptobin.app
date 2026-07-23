#include "cryptobin.h"

#include <getopt.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static void vlog(const char *fmt, ...) {
  if (!cryptobin_cli_verbose) {
    return;
  }
  va_list ap;
  va_start(ap, fmt);
  fputs("→ ", stderr);
  vfprintf(stderr, fmt, ap);
  fputc('\n', stderr);
  va_end(ap);
}

static int parse_ttl_hours(int ttl) {
  if (ttl == 1 || ttl == 24 || ttl == 72 || ttl == 168) {
    return ttl;
  }
  return -1;
}

static int forward_stdin(
  const char *api_base_url,
  const char *public_base_url,
  const char *stream_id,
  const char *producer_token,
  const uint8_t key[CRYPTOBIN_STREAM_KEY_BYTES],
  char *err,
  size_t err_cap) {
  char line[CRYPTOBIN_MAX_STREAM_FRAME + 4];
  char iv_b64[32];
  char ct_b64[((CRYPTOBIN_MAX_STREAM_FRAME + 32) * 4) / 3 + 16];
  char frame[sizeof(ct_b64) + 128];
  int seq = 0;

  while (fgets(line, sizeof(line), stdin)) {
    size_t len = strlen(line);
    if (len == 0) {
      continue;
    }
    if (len >= CRYPTOBIN_MAX_STREAM_FRAME) {
      snprintf(err, err_cap, "Stream line exceeds %d bytes", CRYPTOBIN_MAX_STREAM_FRAME);
      return -1;
    }

    if (fwrite(line, 1, len, stdout) != len || fflush(stdout) != 0) {
      snprintf(err, err_cap, "Failed to write stdout");
      return -1;
    }

    seq++;
    if (encrypt_stream_frame(key, (const uint8_t *)line, len, iv_b64, sizeof(iv_b64), ct_b64, sizeof(ct_b64)) != 0) {
      snprintf(err, err_cap, "Encryption failed");
      return -1;
    }

    int n = snprintf(
      frame,
      sizeof(frame),
      "{\"type\":\"frame\",\"seq\":%d,\"iv\":\"%s\",\"ciphertext\":\"%s\"}",
      seq,
      iv_b64,
      ct_b64);
    if (n < 0 || (size_t)n >= sizeof(frame)) {
      snprintf(err, err_cap, "Failed to build stream frame");
      return -1;
    }

    if (post_stream_payload(api_base_url, public_base_url, stream_id, producer_token, frame, err, err_cap) != 0) {
      return -1;
    }
  }

  if (ferror(stdin)) {
    snprintf(err, err_cap, "Failed to read stdin");
    return -1;
  }

  return post_stream_payload(api_base_url, public_base_url, stream_id, producer_token, "{\"type\":\"end\"}", err, err_cap);
}

int run_stream(int argc, char **argv, int start) {
  stream_opts_t opts = {
    .ttl_hours = 24,
    .label = NULL,
    .base_url = NULL,
  };
  int quiet = 0;

  static struct option long_opts[] = {
    {"url", required_argument, NULL, 'u'},
    {"ttl", required_argument, NULL, 't'},
    {"label", required_argument, NULL, 'l'},
    {"quiet", no_argument, NULL, 'q'},
    {"verbose", no_argument, NULL, 'v'},
    {"help", no_argument, NULL, 'h'},
    {NULL, 0, NULL, 0},
  };

  optind = start;
  int ch;
  while ((ch = getopt_long(argc, argv, "u:t:l:qvh", long_opts, NULL)) != -1) {
    switch (ch) {
      case 'u':
        opts.base_url = optarg;
        break;
      case 't':
        opts.ttl_hours = atoi(optarg);
        break;
      case 'l':
        opts.label = optarg;
        break;
      case 'q':
        quiet = 1;
        break;
      case 'v':
        cryptobin_cli_verbose = 1;
        break;
      case 'h':
        cryptobin_print_usage(argv[0]);
        return 0;
      default:
        return 1;
    }
  }

  if (parse_ttl_hours(opts.ttl_hours) != opts.ttl_hours) {
    fprintf(stderr, "error: TTL must be one of: 1, 24, 72, 168\n");
    return 1;
  }

  char public_url[CRYPTOBIN_MAX_URL];
  if (resolve_base_url(opts.base_url, public_url, sizeof(public_url)) != 0) {
    fprintf(stderr, "error: invalid server URL\n");
    return 1;
  }

  char api_url[CRYPTOBIN_MAX_URL];
  if (resolve_api_base_url(public_url, api_url, sizeof(api_url)) != 0) {
    fprintf(stderr, "error: invalid API URL (CRYPTOBIN_API_URL)\n");
    return 1;
  }

  vlog("Server: %s", public_url);
  if (strcmp(public_url, api_url) != 0) {
    vlog("API: %s", api_url);
  }
  vlog("TTL: %d hour(s)", opts.ttl_hours);

  uint8_t key[CRYPTOBIN_STREAM_KEY_BYTES];
  char key_b64[128];
  if (generate_stream_key(key, key_b64, sizeof(key_b64)) != 0) {
    fprintf(stderr, "error: failed to generate stream key\n");
    return 1;
  }

  char stream_id[128];
  char producer_token[256];
  char err[512];
  if (post_stream_json(
        api_url,
        public_url,
        opts.ttl_hours,
        opts.label,
        stream_id,
        sizeof(stream_id),
        producer_token,
        sizeof(producer_token),
        err,
        sizeof(err)) != 0) {
    fprintf(stderr, "error: %s\n", err);
    return 1;
  }

  char share_url[1024];
  snprintf(share_url, sizeof(share_url), "%s/stream/%s#%s", public_url, stream_id, key_b64);

  if (isatty(STDIN_FILENO)) {
    printf("%s\n", share_url);
    if (!quiet) {
      fprintf(stderr, "warning: pipe stdin to stream, e.g. tail -f file | cryptobin stream\n");
    }
    vlog("Stream id: %s", stream_id);
    return 0;
  }

  fprintf(stderr, "%s\n", share_url);
  vlog("Stream id: %s", stream_id);
  vlog("Forwarding stdin via encrypted HTTP frames (tee to stdout)");

  if (forward_stdin(api_url, public_url, stream_id, producer_token, key, err, sizeof(err)) != 0) {
    fprintf(stderr, "error: %s\n", err);
    return 1;
  }

  return 0;
}
