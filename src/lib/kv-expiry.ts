export type ExpiringArtifactKind = 'analysis' | 'screenshot';

export interface ExpiryMetadata {
  expires_at: string;
}

const EXPIRY_METADATA_RETENTION_SECONDS = 24 * 60 * 60;

export function getExpiryMetadataKey(kind: ExpiringArtifactKind, id: string) {
  return `${kind}-meta:${id}`;
}

export function createExpiryMetadata(ttlSeconds: number): ExpiryMetadata {
  return {
    expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  };
}

export function getExpiryMetadataTtlSeconds(ttlSeconds: number) {
  return ttlSeconds + EXPIRY_METADATA_RETENTION_SECONDS;
}

export function parseExpiryMetadata(
  stored: string | ExpiryMetadata | null | undefined
): ExpiryMetadata | null {
  if (!stored) {
    return null;
  }

  return typeof stored === 'string'
    ? JSON.parse(stored) as ExpiryMetadata
    : stored;
}

export function isExpired(metadata: ExpiryMetadata | null | undefined) {
  if (!metadata) {
    return false;
  }

  return Date.parse(metadata.expires_at) <= Date.now();
}
