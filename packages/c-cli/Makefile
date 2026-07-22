CC ?= gcc
CFLAGS ?= -Wall -Wextra -Wpedantic -O2
LDFLAGS ?= -lcurl -lssl -lcrypto

SRCS = main.c crypto.c http.c config.c
OBJS = $(SRCS:.c=.o)
BIN = cryptobin

.PHONY: all clean test

all: $(BIN)

$(BIN): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $(OBJS) $(LDFLAGS)

%.o: %.c cryptobin.h
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f $(OBJS) $(BIN) test_crypto

test: $(BIN) test_crypto
	./test_crypto
	./$(BIN) --version

test_crypto: test_crypto.c crypto.o http.o config.o cryptobin.h
	$(CC) $(CFLAGS) -o test_crypto test_crypto.c crypto.o http.o config.o $(LDFLAGS)
