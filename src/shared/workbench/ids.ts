/**
 * Workbench ids: generated from the display name, then read-only for life.
 *
 * The id is also the directory name under the workbench root, so it is kept to
 * lowercase ASCII with dashes; a name that slugifies to nothing (for example a
 * purely Chinese name) falls back to a random `wb-` id.
 */
import { WORKBENCH_ID_PATTERN } from './schema';

/** Random-id alphabet and length used by the `wb-` fallback. */
const RANDOM_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const RANDOM_LENGTH = 6;

/** Collapse a display name to lowercase ASCII words joined by single dashes. */
export function slugifyWorkbenchName(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** Build a random `wb-` suffix; `random` is injectable so tests stay deterministic. */
function randomSuffix(random: () => number): string {
  let suffix = '';
  for (let index = 0; index < RANDOM_LENGTH; index += 1) {
    const pick = Math.floor(random() * RANDOM_ALPHABET.length);
    suffix += RANDOM_ALPHABET[Math.min(RANDOM_ALPHABET.length - 1, Math.max(0, pick))];
  }
  return suffix;
}

/**
 * Generate a free workbench id from `name`, avoiding every id in `takenIds`.
 * Collisions (and colliding fallbacks) get `-2`, `-3`, ... appended.
 */
export function generateWorkbenchId(
  name: string,
  takenIds: Iterable<string>,
  random: () => number = Math.random,
): string {
  const taken = new Set(takenIds);
  let base = slugifyWorkbenchName(name);
  if (base === '' || base === 'wb') base = `wb-${randomSuffix(random)}`;
  if (!WORKBENCH_ID_PATTERN.test(base)) base = `wb-${randomSuffix(random)}`;

  let candidate = base;
  let attempt = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-${attempt}`;
    attempt += 1;
  }
  return candidate;
}
