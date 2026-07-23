#include "cryptobin.h"

#include <getopt.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static const char *VERSION = "0.6.8";
int cryptobin_cli_verbose = 0;

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

static int argv_is_verbose_flag(const char *arg) {
  return arg && (strcmp(arg, "-v") == 0 || strcmp(arg, "--verbose") == 0);
}

static int shift_verbose_flags(int argc, char **argv) {
  int write = 1;
  for (int read = 1; read < argc; read++) {
    if (argv_is_verbose_flag(argv[read])) {
      cryptobin_cli_verbose = 1;
      continue;
    }
    argv[write++] = argv[read];
  }
  argv[write] = NULL;
  return write;
}

void cryptobin_print_usage(const char *argv0) {
  fprintf(stderr, "CryptoBin C CLI %s\n\n", VERSION);
  fprintf(stderr, "Usage:\n");
  fprintf(stderr, "  %s secret [text] [options]   Encrypt and print a one-time share URL\n", argv0);
  fprintf(stderr, "  %s create [text]             Alias for secret\n", argv0);
  fprintf(stderr, "  %s stream [options]          Stream stdin to an encrypted live URL\n", argv0);
  fprintf(stderr, "  %s config show               Show configured server URL\n", argv0);
  fprintf(stderr, "  %s config set --url URL      Save default server URL\n", argv0);
  fprintf(stderr, "\nOptions for secret/create:\n");
  fprintf(stderr, "  -u, --url URL        Server base URL (default: CRYPTOBIN_URL, config, or %s)\n", CRYPTOBIN_DEFAULT_URL);
  fprintf(stderr, "      --ttl HOURS      1, 24, 72, or 168 (default 24)\n");
  fprintf(stderr, "      --from NAME      Optional sender metadata\n");
  fprintf(stderr, "      --label TEXT     Optional label metadata\n");
  fprintf(stderr, "      --description TEXT\n");
  fprintf(stderr, "      -q, --quiet      Print only the share URL\n");
  fprintf(stderr, "  -v, --verbose        Print progress to stderr (repeatable before command)\n");
  fprintf(stderr, "\nOptions for stream:\n");
  fprintf(stderr, "  -u, --url URL        Server base URL\n");
  fprintf(stderr, "      --ttl HOURS      1, 24, 72, or 168 (default 24)\n");
  fprintf(stderr, "      --label TEXT     Optional stream label\n");
  fprintf(stderr, "      -q, --quiet      Print only the share URL\n");
  fprintf(stderr, "\nExamples:\n");
  fprintf(stderr, "  %s secret \"rotate-this-key\"\n", argv0);
  fprintf(stderr, "  echo token | %s secret\n", argv0);
  fprintf(stderr, "  tail -f log | %s stream\n", argv0);
}

static char *read_stdin_all(void) {
  size_t cap = 65536;
  size_t len = 0;
  char *buf = malloc(cap);
  if (!buf) {
    return NULL;
  }

  while (1) {
    if (len + 1 >= cap) {
      if (cap >= CRYPTOBIN_MAX_SECRET + 1) {
        free(buf);
        return NULL;
      }
      size_t next_cap = cap * 2;
      if (next_cap > CRYPTOBIN_MAX_SECRET + 1) {
        next_cap = CRYPTOBIN_MAX_SECRET + 1;
      }
      char *next = realloc(buf, next_cap);
      if (!next) {
        free(buf);
        return NULL;
      }
      buf = next;
      cap = next_cap;
    }
    size_t n = fread(buf + len, 1, cap - len - 1, stdin);
    len += n;
    if (n == 0) {
      break;
    }
  }

  while (len > 0 && (buf[len - 1] == '\n' || buf[len - 1] == '\r')) {
    len--;
  }
  buf[len] = '\0';
  if (len > CRYPTOBIN_MAX_SECRET) {
    free(buf);
    return NULL;
  }
  return buf;
}

static int run_secret(int argc, char **argv, int start, int quiet_default) {
  secret_opts_t opts = {
    .ttl_hours = 24,
    .from = NULL,
    .label = NULL,
    .description = NULL,
    .base_url = NULL,
  };

  int quiet = quiet_default;
  const char *secret_arg = NULL;

  static struct option long_opts[] = {
    {"url", required_argument, NULL, 'u'},
    {"ttl", required_argument, NULL, 't'},
    {"from", required_argument, NULL, 'f'},
    {"label", required_argument, NULL, 'l'},
    {"description", required_argument, NULL, 'd'},
    {"quiet", no_argument, NULL, 'q'},
    {"verbose", no_argument, NULL, 'v'},
    {"help", no_argument, NULL, 'h'},
    {NULL, 0, NULL, 0},
  };

  optind = start;
  int ch;
  while ((ch = getopt_long(argc, argv, "u:t:f:l:d:qvh", long_opts, NULL)) != -1) {
    switch (ch) {
      case 'u':
        opts.base_url = optarg;
        break;
      case 't':
        opts.ttl_hours = atoi(optarg);
        break;
      case 'f':
        opts.from = optarg;
        break;
      case 'l':
        opts.label = optarg;
        break;
      case 'd':
        opts.description = optarg;
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

  if (optind < argc) {
    secret_arg = argv[optind];
    if (!quiet && quiet_default) {
      quiet = 1;
    }
  }

  char *stdin_body = NULL;
  const char *body = secret_arg;
  if (!body) {
    if (!isatty(STDIN_FILENO)) {
      stdin_body = read_stdin_all();
      if (!stdin_body) {
        fprintf(stderr, "error: secret is too large (max 4 MiB) or could not read stdin\n");
        return 1;
      }
      body = stdin_body;
    } else {
      fprintf(stderr, "error: pass secret text, pipe via stdin, or use --help\n");
      return 1;
    }
  }

  if (!body || !body[0]) {
    fprintf(stderr, "error: secret cannot be empty\n");
    free(stdin_body);
    return 1;
  }

  vlog("Secret size: %zu bytes", strlen(body));
  char preview_url[CRYPTOBIN_MAX_URL];
  if (resolve_base_url(opts.base_url, preview_url, sizeof(preview_url)) == 0) {
    vlog("Server: %s", preview_url);
  }
  vlog("TTL: %d hour(s)", opts.ttl_hours);
  vlog("Encrypting locally…");

  secret_result_t result;
  char err[512];
  vlog("Uploading ciphertext…");
  if (encrypt_and_upload_secret(body, &opts, &result, err, sizeof(err)) != 0) {
    fprintf(stderr, "error: %s\n", err);
    free(stdin_body);
    return 1;
  }

  free(stdin_body);
  vlog("Share id: %s", result.id);
  (void)quiet;
  printf("%s\n", result.url);
  return 0;
}

static int run_config(int argc, char **argv, int start) {
  if (start >= argc) {
    cryptobin_print_usage(argv[0]);
    return 1;
  }

  if (strcmp(argv[start], "show") == 0) {
    char url[CRYPTOBIN_MAX_URL];
    if (resolve_base_url(NULL, url, sizeof(url)) != 0) {
      fprintf(stderr, "error: invalid server URL\n");
      return 1;
    }
    printf("%s\n", url);
    return 0;
  }

  if (strcmp(argv[start], "set") == 0) {
    const char *url = NULL;
    static struct option long_opts[] = {
      {"url", required_argument, NULL, 'u'},
      {NULL, 0, NULL, 0},
    };
    optind = start + 1;
    int ch;
    while ((ch = getopt_long(argc, argv, "", long_opts, NULL)) != -1) {
      if (ch == 'u') {
        url = optarg;
      }
    }
    if (!url) {
      fprintf(stderr, "error: config set requires --url\n");
      return 1;
    }
    char normalized[CRYPTOBIN_MAX_URL];
    if (resolve_base_url(url, normalized, sizeof(normalized)) != 0) {
      fprintf(stderr, "error: invalid server URL\n");
      return 1;
    }
    if (save_config_url(normalized) != 0) {
      fprintf(stderr, "error: could not save config\n");
      return 1;
    }
    printf("Default server set to %s\n", normalized);
    return 0;
  }

  cryptobin_print_usage(argv[0]);
  return 1;
}

int main(int argc, char **argv) {
  argc = shift_verbose_flags(argc, argv);

  if (argc >= 2 && (strcmp(argv[1], "-V") == 0 || strcmp(argv[1], "--version") == 0)) {
    printf("cryptobin %s (C)\n", VERSION);
    return 0;
  }

  if (argc < 2) {
    cryptobin_print_usage(argv[0]);
    return 1;
  }

  if (strcmp(argv[1], "secret") == 0) {
    return run_secret(argc, argv, 2, 1);
  }

  if (strcmp(argv[1], "create") == 0) {
    return run_secret(argc, argv, 2, 0);
  }

  if (strcmp(argv[1], "stream") == 0) {
    return run_stream(argc, argv, 2);
  }

  if (strcmp(argv[1], "config") == 0) {
    return run_config(argc, argv, 2);
  }

  if (strcmp(argv[1], "-h") == 0 || strcmp(argv[1], "--help") == 0) {
    cryptobin_print_usage(argv[0]);
    return 0;
  }

  cryptobin_print_usage(argv[0]);
  return 1;
}
