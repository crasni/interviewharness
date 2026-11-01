import { keyProviderTable } from '@interviewharness/providers';

/**
 * The page where `provider`'s keys are made, from the table of key providers, or undefined for anything
 * else. The renderer names a provider, never an address, so "Get a key" can only ever open these pages.
 */
export function keyPageFor(provider: unknown): string | undefined {
  return keyProviderTable.find((row) => row.id === provider)?.keyPage;
}
