import { APP_NAME } from '../config';

export function Wordmark({ size = 44 }: { size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      {APP_NAME}
      <span className="wordmark__dot">.</span>
    </span>
  );
}
