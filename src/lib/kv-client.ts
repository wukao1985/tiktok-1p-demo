import { kv as vercelKv } from '@vercel/kv';

type ExpireOption = 'NX' | 'nx' | 'XX' | 'xx' | 'GT' | 'gt' | 'LT' | 'lt';

type SetCommandOptions = {
  get?: boolean;
} & (
  | {
      ex: number;
      px?: never;
      exat?: never;
      pxat?: never;
      keepTtl?: never;
    }
  | {
      ex?: never;
      px: number;
      exat?: never;
      pxat?: never;
      keepTtl?: never;
    }
  | {
      ex?: never;
      px?: never;
      exat: number;
      pxat?: never;
      keepTtl?: never;
    }
  | {
      ex?: never;
      px?: never;
      exat?: never;
      pxat: number;
      keepTtl?: never;
    }
  | {
      ex?: never;
      px?: never;
      exat?: never;
      pxat?: never;
      keepTtl: true;
    }
  | {
      ex?: never;
      px?: never;
      exat?: never;
      pxat?: never;
      keepTtl?: never;
    }
) &
  (
    | {
        nx: true;
        xx?: never;
      }
    | {
        xx: true;
        nx?: never;
      }
    | {
        xx?: never;
        nx?: never;
      }
  );

interface KvEntry {
  value: unknown;
  expiresAt?: number;
}

export interface KvClient {
  get<TData = string>(key: string): Promise<TData | null>;
  set<TData>(key: string, value: TData, opts?: SetCommandOptions): Promise<TData | 'OK' | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number, option?: ExpireOption): Promise<0 | 1>;
}

const fallbackStore = new Map<string, KvEntry>();
const hasRemoteKvConfig = Boolean(process.env.KV_REST_API_URL);
const isLocalDevelopment = process.env.NODE_ENV === 'development';
const allowMemoryKvFallback =
  !hasRemoteKvConfig &&
  (
    isLocalDevelopment ||
    (
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_MEMORY_KV === 'true'
    )
  );

function isEntryExpired(entry: KvEntry) {
  return entry.expiresAt !== undefined && entry.expiresAt <= Date.now();
}

function getActiveEntry(key: string) {
  const entry = fallbackStore.get(key);

  if (!entry) {
    return null;
  }

  if (isEntryExpired(entry)) {
    fallbackStore.delete(key);
    return null;
  }

  return entry;
}

function getExpiryForSet(key: string, opts?: SetCommandOptions) {
  if (!opts) {
    return undefined;
  }

  if ('ex' in opts && typeof opts.ex === 'number') {
    return Date.now() + (opts.ex * 1000);
  }

  if ('px' in opts && typeof opts.px === 'number') {
    return Date.now() + opts.px;
  }

  if ('exat' in opts && typeof opts.exat === 'number') {
    return opts.exat * 1000;
  }

  if ('pxat' in opts && typeof opts.pxat === 'number') {
    return opts.pxat;
  }

  if ('keepTtl' in opts && opts.keepTtl) {
    return getActiveEntry(key)?.expiresAt;
  }

  return undefined;
}

function toInteger(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);

    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }

  throw new Error('ERR value is not an integer or out of range');
}

const fallbackKv: KvClient = {
  async get<TData = string>(key: string) {
    return (getActiveEntry(key)?.value ?? null) as TData | null;
  },

  async set<TData>(key: string, value: TData, opts?: SetCommandOptions) {
    const existing = getActiveEntry(key);

    if (opts?.nx && existing) {
      return null;
    }

    if (opts?.xx && !existing) {
      return null;
    }

    const expiresAt = getExpiryForSet(key, opts);
    const previousValue = existing?.value ?? null;

    fallbackStore.set(key, {
      value,
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    });

    return (opts?.get ? previousValue : 'OK') as TData | 'OK' | null;
  },

  async incr(key: string) {
    const existing = getActiveEntry(key);
    const nextValue = (existing ? toInteger(existing.value) : 0) + 1;

    fallbackStore.set(key, {
      value: nextValue,
      ...(existing?.expiresAt !== undefined ? { expiresAt: existing.expiresAt } : {}),
    });

    return nextValue;
  },

  async expire(key: string, seconds: number, option?: ExpireOption) {
    const existing = getActiveEntry(key);

    if (!existing) {
      return 0;
    }

    const normalizedOption = option?.toLowerCase();
    const expiresAt = Date.now() + (seconds * 1000);

    if (normalizedOption === 'nx' && existing.expiresAt !== undefined) {
      return 0;
    }

    if (normalizedOption === 'xx' && existing.expiresAt === undefined) {
      return 0;
    }

    if (
      normalizedOption === 'gt' &&
      (existing.expiresAt === undefined || expiresAt <= existing.expiresAt)
    ) {
      return 0;
    }

    if (normalizedOption === 'lt' && existing.expiresAt !== undefined && expiresAt >= existing.expiresAt) {
      return 0;
    }

    fallbackStore.set(key, {
      value: existing.value,
      expiresAt,
    });

    return 1;
  },
};

function createMissingKvError() {
  const baseMessage =
    'Vercel KV is required for persistent analysis storage. Set KV_REST_API_URL to a real KV instance.';

  if (process.env.NODE_ENV === 'production') {
    return new Error(`${baseMessage} In production, the in-memory KV fallback is disabled.`);
  }

  return new Error(
    `${baseMessage} For ephemeral non-production runs, set ALLOW_MEMORY_KV=true to opt into the in-memory fallback.`
  );
}

const disabledKv: KvClient = {
  async get<TData = string>(_key: string) {
    throw createMissingKvError();
  },

  async set<TData>(_key: string, _value: TData, _opts?: SetCommandOptions) {
    throw createMissingKvError();
  },

  async incr(_key: string) {
    throw createMissingKvError();
  },

  async expire(_key: string, _seconds: number, _option?: ExpireOption) {
    throw createMissingKvError();
  },
};

export const kv: KvClient = hasRemoteKvConfig
  ? vercelKv
  : allowMemoryKvFallback
    ? fallbackKv
    : disabledKv;
