import { APP_NAME } from '../config';

/** "OutBound" + a Red Line station dot */
export function Wordmark({ size = 44, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className={`wordmark${light ? ' wordmark--light' : ''}`} style={{ fontSize: size }}>
      {APP_NAME}
      <span className="wordmark__dot" aria-hidden />
    </span>
  );
}
