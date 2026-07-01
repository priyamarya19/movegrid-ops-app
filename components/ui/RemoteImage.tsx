import { useState } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

import { API_BASE_URL } from '@/constants/config';
import { useAuth } from '@/lib/auth-context';

/**
 * Renders a private S3 file (stored as a key) via the dashboard's /api/file
 * endpoint, which redirects to a short-lived presigned URL. Falls back to
 * `fallback` while there's no key/token or if the image fails to load.
 */
export function RemoteImage({
  fileKey,
  style,
  fallback,
}: {
  fileKey: string | null | undefined;
  style: StyleProp<ImageStyle>;
  fallback: React.ReactNode;
}) {
  const { token } = useAuth();
  const [failed, setFailed] = useState(false);

  if (!fileKey || failed || !token) return <>{fallback}</>;

  return (
    <Image
      style={style}
      source={{
        uri: `${API_BASE_URL}/api/file?key=${encodeURIComponent(fileKey)}`,
        headers: { Authorization: `Bearer ${token}`, 'X-Client-Type': 'mobile' },
      }}
      onError={() => setFailed(true)}
    />
  );
}
