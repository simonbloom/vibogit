# GitHub Gist API Reference

## Using gh CLI (preferred for ViboGit)

### Create private Gist
```bash
echo '{"machines":[]}' > /tmp/vibogit-beacon.json
gh gist create --public=false /tmp/vibogit-beacon.json
# Returns: https://gist.github.com/<id>
# Extract ID from URL
```

### Read Gist
```bash
gh gist view <gist_id> --raw -f vibogit-beacon.json
# Returns file content as raw text
```

### Update Gist
```bash
echo '{"machines":[...]}' > /tmp/vibogit-beacon.json
gh gist edit <gist_id> -f vibogit-beacon.json /tmp/vibogit-beacon.json
```

### Check auth
```bash
gh auth status
# Exit code 0 = authenticated, non-zero = not authenticated
```

## REST API (alternative)

Base: `https://api.github.com`
Auth: `Authorization: Bearer <token>`

| Op | Method | Endpoint |
|---|---|---|
| Create | POST | /gists |
| Read | GET | /gists/{id} |
| Update | PATCH | /gists/{id} |
| Delete | DELETE | /gists/{id} |

Rate limit: 5000 req/hour authenticated.

## Beacon JSON Schema

```json
{
  "machines": [
    {
      "name": "MacBook-Home",
      "timestamp": "2026-03-23T10:30:00Z",
      "repos": [
        {
          "path": "/Users/simon/projects/myapp",
          "name": "myapp",
          "branch": "main",
          "ahead": 3,
          "behind": 0,
          "lastCommitHash": "abc123",
          "lastCommitMessage": "feat: add login",
          "lastCommitTimestamp": "2026-03-23T10:25:00Z"
        }
      ]
    }
  ]
}
```
