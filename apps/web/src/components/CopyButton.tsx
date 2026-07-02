import { Clipboard } from 'lucide-react';
import { useState } from 'react';

interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  variant?: 'primary' | 'inline';
  className?: string;
}

export default function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied!',
  variant = 'primary',
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const classes = [
    variant === 'inline' ? 'copy-inline-btn' : 'create-btn',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button type="button" className={classes} onClick={() => void handleCopy()}>
      <Clipboard size={variant === 'inline' ? 14 : 15} aria-hidden="true" />
      {copied ? copiedLabel : label}
    </button>
  );
}
