# Semantic Release Setup

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) for automated versioning and releases.

## How It Works

Semantic-release automates the entire release workflow:
1. Analyzes commit messages to determine the next version
2. Generates release notes and CHANGELOG.md
3. Updates `build.zig.zon` with the new version
4. Creates a Git tag and GitHub release
5. Triggers the Docker build workflow (via the tag)

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types that trigger releases:

- `feat:` - New feature → **minor** version bump (0.1.0 → 0.2.0)
- `fix:` - Bug fix → **patch** version bump (0.1.0 → 0.1.1)
- `perf:` - Performance improvement → **patch** version bump
- `revert:` - Reverts a previous commit → **patch** version bump

### Types that DON'T trigger releases:

- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring (shown in changelog)
- `test:` - Test changes
- `build:` - Build system changes
- `ci:` - CI/CD changes
- `chore:` - Other changes

### Breaking Changes

Add `BREAKING CHANGE:` in the commit footer to trigger a **major** version bump (0.1.0 → 1.0.0):

```
feat: remove deprecated API endpoint

BREAKING CHANGE: The /old-api endpoint has been removed. Use /new-api instead.
```

## Examples

```bash
# Patch release (0.1.0 → 0.1.1)
git commit -m "fix: resolve database connection timeout"

# Minor release (0.1.0 → 0.2.0)
git commit -m "feat: add book search functionality"

# Minor with description
git commit -m "feat: add user preferences

Allows users to customize their reading experience with theme and layout options."

# Major release (0.1.0 → 1.0.0)
git commit -m "feat: redesign authentication system

BREAKING CHANGE: JWT tokens from v0.x are no longer valid. Users must re-authenticate."

# Multiple changes (no release)
git commit -m "chore: update dependencies
docs: improve API documentation"
```

## Workflow

1. **Develop**: Make changes and commit with conventional commit messages
2. **Push to main**: Push commits to the `main` branch
3. **Automatic Release**: The GitHub Action runs semantic-release which:
   - Builds binaries for Linux, macOS, and Windows (x86_64 and ARM64)
   - Determines version based on commits
   - Updates `build.zig.zon` and `CHANGELOG.md`
   - Creates a release commit and tag
   - Publishes GitHub release with binary artifacts
4. **Docker Build**: The new tag triggers the Docker workflow automatically

## Testing Locally

To test semantic-release locally (dry-run):

```bash
npm install
npx semantic-release --dry-run
```

## Manual Release

Semantic-release runs automatically on push to `main`. There's no need to manually create releases or tags.

## Configuration

- **`.releaserc.json`**: Semantic-release configuration
- **`scripts/update-zig-version.js`**: Updates version in `build.zig.zon`
- **`.github/workflows/release.yml`**: GitHub Actions workflow
- **`CHANGELOG.md`**: Auto-generated changelog

## Files Updated by Releases

- `build.zig.zon` - Version field
- `CHANGELOG.md` - Release notes
- Git tags - Created for each release
- GitHub Releases - Created with release notes and binary artifacts

## Binary Artifacts

Each GitHub release includes pre-compiled binaries for:

| Platform | Architecture | File |
|----------|-------------|------|
| Linux | x86_64 | `dust-server-linux-x86_64.tar.gz` |
| Linux | aarch64 (ARM64) | `dust-server-linux-aarch64.tar.gz` |
| macOS | x86_64 (Intel) | `dust-server-macos-x86_64.tar.gz` |
| macOS | aarch64 (Apple Silicon) | `dust-server-macos-aarch64.tar.gz` |

All binaries are built with `ReleaseSafe` optimization for production use.

> **Note:** Windows builds are not currently supported due to POSIX-specific code (signal handling, etc.). The server is designed for Unix-like systems. Use Docker or WSL on Windows.

## Skipping CI

To skip the release workflow, add `[skip ci]` to your commit message:

```bash
git commit -m "docs: update README [skip ci]"
```

Note: Release commits automatically include `[skip ci]` to prevent recursive builds.
