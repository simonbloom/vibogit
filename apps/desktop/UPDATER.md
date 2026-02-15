# ViboGit Auto-Updater Setup

The ViboGit desktop app uses Tauri's built-in updater for automatic updates.

## How It Works

1. On app launch and periodically, the app checks the update endpoint
2. If a new version is available, the user is prompted to update
3. The update is downloaded and installed automatically

## Update Endpoint

The updater expects a JSON response from:
```
https://vibogit.app/api/updates/{target}/{arch}/{current_version}
```

Where:
- `{target}` = `darwin` (macOS), `windows`, `linux`
- `{arch}` = `x86_64`, `aarch64`
- `{current_version}` = Current app version (e.g., `0.1.0`)

### Response Format

**When update available:**
```json
{
  "version": "0.2.0",
  "notes": "What's new in this release...",
  "pub_date": "2026-02-03T12:00:00Z",
  "platforms": {
    "darwin-x86_64": {
      "signature": "...",
      "url": "https://github.com/vibogit/vibogit/releases/download/v0.2.0/ViboGit_0.2.0_x64.dmg"
    },
    "darwin-aarch64": {
      "signature": "...",
      "url": "https://github.com/vibogit/vibogit/releases/download/v0.2.0/ViboGit_0.2.0_aarch64.dmg"
    }
  }
}
```

**When no update available:**
Return HTTP 204 No Content

## Setting Up Code Signing for Updates

1. Generate a key pair:
   ```bash
   cargo tauri signer generate -w ~/.tauri/vibogit.key
   ```

2. Add the public key to `tauri.conf.json`:
   ```json
   "plugins": {
     "updater": {
       "pubkey": "YOUR_PUBLIC_KEY_HERE"
     }
   }
   ```

3. Set environment variable for signing:
   ```bash
   export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/vibogit.key)
   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-password"
   ```

4. Build with signing:
   ```bash
   cd /Users/simonbloom/apps-vol11/vibogit/apps/desktop
   node_modules/.bin/tauri build
   ```

## GitHub Releases Integration

For simplest setup, use GitHub Releases:

1. Create releases with semantic version tags (e.g., `v0.2.0`)
2. Upload signed DMG/app bundles as release assets
3. Use a serverless function to proxy GitHub releases API to the expected format

### Example Vercel Edge Function

```typescript
// api/updates/[...params].ts
export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const [, , target, arch, currentVersion] = url.pathname.split('/');
  
  const response = await fetch(
    'https://api.github.com/repos/vibogit/vibogit/releases/latest'
  );
  
  if (!response.ok) {
    return new Response(null, { status: 204 });
  }
  
  const release = await response.json();
  const newVersion = release.tag_name.replace('v', '');
  
  if (newVersion <= currentVersion) {
    return new Response(null, { status: 204 });
  }
  
  // Find matching asset
  const platform = `${target}-${arch}`;
  const asset = release.assets.find(a => 
    a.name.includes(platform) && a.name.endsWith('.tar.gz')
  );
  
  if (!asset) {
    return new Response(null, { status: 204 });
  }
  
  return Response.json({
    version: newVersion,
    notes: release.body,
    pub_date: release.published_at,
    platforms: {
      [platform]: {
        signature: '', // Read from .sig file
        url: asset.browser_download_url
      }
    }
  });
}
```

## Testing Updates

1. Build version 0.1.0 and install
2. Build version 0.2.0 and upload to GitHub Releases
3. Launch the 0.1.0 app - it should prompt to update
