#include "cryptobin.h"

#include <ctype.h>
#include <errno.h>
#include <pwd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

static int config_path(char *out, size_t out_cap) {
  const char *home = getenv("HOME");
  if (!home || !home[0]) {
    struct passwd *pw = getpwuid(getuid());
    home = pw ? pw->pw_dir : NULL;
  }
  if (!home) {
    return -1;
  }
  int n = snprintf(out, out_cap, "%s/.config/cryptobin/config.json", home);
  return n < 0 || (size_t)n >= out_cap ? -1 : 0;
}

static int extract_url_value(const char *json, char *out, size_t out_cap) {
  const char *key = "\"url\"";
  const char *start = strstr(json, key);
  if (!start) {
    return -1;
  }
  start = strchr(start, ':');
  if (!start) {
    return -1;
  }
  start++;
  while (*start && isspace((unsigned char)*start)) {
    start++;
  }
  if (*start != '"') {
    return -1;
  }
  start++;
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

static int ensure_config_dir(const char *config_file) {
  char dir[512];
  snprintf(dir, sizeof(dir), "%s", config_file);
  char *slash = strrchr(dir, '/');
  if (!slash) {
    return -1;
  }
  *slash = '\0';
  if (mkdir(dir, 0700) != 0 && errno != EEXIST) {
    char parent[512];
    snprintf(parent, sizeof(parent), "%s", dir);
    slash = strrchr(parent, '/');
    if (slash) {
      *slash = '\0';
      if (mkdir(parent, 0700) != 0 && errno != EEXIST) {
        return -1;
      }
    }
    if (mkdir(dir, 0700) != 0 && errno != EEXIST) {
      return -1;
    }
  }
  return 0;
}

int load_config_url(char *out, size_t out_cap) {
  char path[512];
  if (config_path(path, sizeof(path)) != 0) {
    return -1;
  }

  FILE *f = fopen(path, "r");
  if (!f) {
    return -1;
  }

  char buf[CRYPTOBIN_MAX_URL + 64];
  size_t n = fread(buf, 1, sizeof(buf) - 1, f);
  fclose(f);
  buf[n] = '\0';

  return extract_url_value(buf, out, out_cap);
}

int save_config_url(const char *url) {
  char path[512];
  if (!url || strchr(url, '"')) {
    return -1;
  }
  if (config_path(path, sizeof(path)) != 0) {
    return -1;
  }
  if (ensure_config_dir(path) != 0) {
    return -1;
  }

  FILE *f = fopen(path, "w");
  if (!f) {
    return -1;
  }
  fprintf(f, "{\n  \"url\": \"%s\"\n}\n", url);
  fclose(f);
  return 0;
}

static void strip_trailing_slash(char *url) {
  size_t len = strlen(url);
  while (len > 0 && url[len - 1] == '/') {
    url[--len] = '\0';
  }
}

int resolve_base_url(const char *flag_url, char *out, size_t out_cap) {
  const char *env = getenv("CRYPTOBIN_URL");
  if (flag_url && flag_url[0]) {
    snprintf(out, out_cap, "%s", flag_url);
  } else if (env && env[0]) {
    snprintf(out, out_cap, "%s", env);
  } else if (load_config_url(out, out_cap) == 0) {
    /* loaded */
  } else {
    snprintf(out, out_cap, "%s", CRYPTOBIN_DEFAULT_URL);
  }
  strip_trailing_slash(out);
  if (strncmp(out, "http://", 7) != 0 && strncmp(out, "https://", 8) != 0) {
    return -1;
  }
  return 0;
}
