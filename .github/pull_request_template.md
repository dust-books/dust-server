## Description

<!-- Provide a clear and concise description of your changes -->

## Type of Change

<!-- Check the relevant option(s) -->

- [ ] 🐛 Bug fix (`fix:` - triggers patch release)
- [ ] ✨ New feature (`feat:` - triggers minor release)
- [ ] 💥 Breaking change (`BREAKING CHANGE:` - triggers major release)
- [ ] 📝 Documentation update (`docs:`)
- [ ] ♻️ Code refactoring (`refactor:`)
- [ ] ⚡ Performance improvement (`perf:`)
- [ ] ✅ Test update (`test:`)
- [ ] 🔧 Build/CI change (`build:`, `ci:`)
- [ ] 🧹 Chore/maintenance (`chore:`)

## Related Issue

<!-- Link to the issue this PR addresses -->

Closes #

## Commit Message Format

Please ensure your commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Examples:

**Bug Fix (Patch Release):**
```
fix: resolve database connection timeout

Fixed an issue where the database connection would timeout
after 30 seconds of inactivity.

Fixes #123
```

**New Feature (Minor Release):**
```
feat: add book search by ISBN

Implements ISBN-based search functionality allowing users
to quickly find books by their ISBN number.

Closes #456
```

**Breaking Change (Major Release):**
```
feat: redesign authentication system

Replaced JWT-based auth with OAuth2 for better security
and integration with external providers.

BREAKING CHANGE: Old JWT tokens are no longer valid.
All users must re-authenticate after this update.

Closes #789
```

**Documentation:**
```
docs: update installation guide

Added Windows-specific instructions and troubleshooting
section for common installation issues.

Closes #101
```

## Testing

<!-- Describe the tests you ran and how to reproduce them -->

- [ ] I have tested these changes locally
- [ ] All existing tests pass
- [ ] I have added new tests (if applicable)

## Checklist

- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code where necessary
- [ ] My changes generate no new warnings
- [ ] My commit messages follow the Conventional Commits format

## Additional Context

<!-- Add any other context, screenshots, or information about the PR -->
