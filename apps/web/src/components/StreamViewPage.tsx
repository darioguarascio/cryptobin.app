import { useEffect, useRef, useState } from 'react';
import { Radio, Wifi, WifiOff } from 'lucide-react';
import { decryptStreamFrame, type StreamFrame } from '@/lib/streamCrypto';
import CipherHeroCanvas from './CipherHeroCanvas';
import ThemeSwitcher from './ThemeSwitcher';

type ConnectionState = 'connecting' | 'live' | 'ended' | 'error';

interface StreamViewPageProps {
  streamId: string;
}

function readStreamKey(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const raw = window.location.hash.slice(1);
  if (!raw) {
    return '';
  }
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function webCryptoUnavailableMessage(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  if (window.crypto?.subtle) {
    return null;
  }
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'Web Crypto is unavailable in this browser.';
  }
    return (
      'Decryption requires HTTPS. Open the share link with https:// in the URL.'
    );
}

function viewerEventsUrl(streamId: string): string {
  return `/api/streams/${encodeURIComponent(streamId)}/events`;
}

export default function StreamViewPage({ streamId }: StreamViewPageProps) {
  const [text, setText] = useState('');
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [errorMessage, setErrorMessage] = useState('');
  const logRef = useRef<HTMLPreElement>(null);
  const decryptChain = useRef(Promise.resolve());

  useEffect(() => {
    const cryptoError = webCryptoUnavailableMessage();
    if (cryptoError) {
      setConnection('error');
      setErrorMessage(cryptoError);
      return;
    }

    const key = readStreamKey();
    if (!streamId || !key) {
      setConnection('error');
      setErrorMessage('This link is missing the stream id or decryption key.');
      return;
    }

    const source = new EventSource(viewerEventsUrl(streamId));

    const handlePayload = (message: { type?: string; message?: string } & Partial<StreamFrame>) => {
      if (message.type === 'hello') {
        setConnection('live');
        return;
      }

      if (message.type === 'end') {
        setConnection('ended');
        source.close();
        return;
      }

      if (
        message.type === 'frame' &&
        typeof message.seq === 'number' &&
        message.iv &&
        message.ciphertext
      ) {
        const { seq, iv, ciphertext } = message;
        decryptChain.current = decryptChain.current.then(async () => {
          const plaintext = await decryptStreamFrame(key, { seq, iv, ciphertext });
          setText((current) => current + plaintext);
          setConnection('live');
        }).catch((error: unknown) => {
          setConnection('error');
          const cryptoBlocked = webCryptoUnavailableMessage();
          if (cryptoBlocked) {
            setErrorMessage(cryptoBlocked);
          } else if (error instanceof DOMException && error.name === 'OperationError') {
            setErrorMessage(
              'Unable to decrypt this stream. Use the exact link from the current cryptobin stream run (stderr), not an older tab.',
            );
          } else {
            setErrorMessage('Unable to decrypt stream data. Check that you have the correct link.');
          }
          source.close();
        });
      }
    };

    source.onmessage = (event) => {
      try {
        handlePayload(JSON.parse(event.data) as Parameters<typeof handlePayload>[0]);
      } catch {
        setConnection('error');
        setErrorMessage('Invalid stream message from server.');
      }
    };

    source.onerror = () => {
      if (source.readyState === EventSource.CONNECTING) {
        return;
      }
      if (source.readyState === EventSource.CLOSED) {
        setConnection((current) => (current === 'error' ? current : 'ended'));
        return;
      }
      setConnection('error');
      setErrorMessage('Stream connection failed.');
    };

    return () => {
      source.close();
    };
  }, [streamId]);

  useEffect(() => {
    const node = logRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [text]);

  const statusLabel =
    connection === 'connecting'
      ? 'Connecting…'
      : connection === 'live'
        ? 'Live'
        : connection === 'ended'
          ? 'Stream ended'
          : 'Unavailable';

  return (
    <div className="page">
      <CipherHeroCanvas />

      <div className="page-inner">
        <header className="top-bar">
          <div className="top-bar-logo">
            <Radio size={16} />
            CryptoBin Stream
          </div>
          <div className="top-bar-actions">
            <ThemeSwitcher />
          </div>
        </header>

        <div className="receive-center">
          <div className="receive-header">
            <div className="receive-header-icon">
              {connection === 'live' ? <Wifi size={24} aria-hidden="true" /> : <WifiOff size={24} aria-hidden="true" />}
            </div>
            <h1>Encrypted live stream</h1>
          </div>

          <section className="receive-card">
            <p className={`stream-status stream-status-${connection}`} role="status">
              {statusLabel}
            </p>

            {connection === 'error' && (
              <p className="receive-status receive-status-error" role="alert">
                {errorMessage}
              </p>
            )}

            <div className="secret-display stream-log-shell">
              <pre ref={logRef} className="secret-body stream-log">
                {text || (connection === 'connecting' ? 'Waiting for encrypted frames…' : '')}
              </pre>
            </div>

            <p className="receive-reveal-copy">
              Frames are encrypted on the machine running <code>cryptobin stream</code> and
              decrypted here in your browser. The key stays in the URL fragment, which is never
              sent to the server.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
