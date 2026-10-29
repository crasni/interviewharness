export { createProviders, defaultChatGPTModel, errorKind } from './providers.ts';
export type { ChatGPTLoginOptions, ModelChoice, ProviderName, Providers, ProvidersOptions } from './providers.ts';
// The credential store's shape is pi-ai's; the app implements it (with the OS's encryption) without importing pi-ai.
export type { Credential, CredentialInfo, CredentialStore } from '@earendil-works/pi-ai';
