// Keychain service for secure storage of API keys
// Note: keytar requires native compilation, so we provide a fallback

const SERVICE_NAME = "vibogit";

interface KeychainService {
  getPassword(account: string): Promise<string | null>;
  setPassword(account: string, password: string): Promise<void>;
  deletePassword(account: string): Promise<boolean>;
}

// Try to use keytar if available, otherwise use in-memory storage
let keychainService: KeychainService;

try {
  // Dynamic import to handle cases where keytar isn't available
  const keytar = require("keytar");
  
  keychainService = {
    async getPassword(account: string): Promise<string | null> {
      return await keytar.getPassword(SERVICE_NAME, account);
    },
    async setPassword(account: string, password: string): Promise<void> {
      await keytar.setPassword(SERVICE_NAME, account, password);
    },
    async deletePassword(account: string): Promise<boolean> {
      return await keytar.deletePassword(SERVICE_NAME, account);
    },
  };
  
  console.log("[Keychain] Using native keychain storage");
} catch {
  // Fallback to in-memory storage (not persistent, but works without native deps)
  const storage = new Map<string, string>();
  
  keychainService = {
    async getPassword(account: string): Promise<string | null> {
      return storage.get(account) || null;
    },
    async setPassword(account: string, password: string): Promise<void> {
      storage.set(account, password);
    },
    async deletePassword(account: string): Promise<boolean> {
      return storage.delete(account);
    },
  };
  
  console.log("[Keychain] Using in-memory storage (keytar not available)");
}

export class SecureStorage {
  async getApiKey(provider: string): Promise<string | null> {
    return keychainService.getPassword(`api-key-${provider}`);
  }

  async setApiKey(provider: string, key: string): Promise<void> {
    await keychainService.setPassword(`api-key-${provider}`, key);
  }

  async deleteApiKey(provider: string): Promise<boolean> {
    return keychainService.deletePassword(`api-key-${provider}`);
  }

  async getToken(service: string): Promise<string | null> {
    return keychainService.getPassword(`token-${service}`);
  }

  async setToken(service: string, token: string): Promise<void> {
    await keychainService.setPassword(`token-${service}`, token);
  }

  async deleteToken(service: string): Promise<boolean> {
    return keychainService.deletePassword(`token-${service}`);
  }
}
