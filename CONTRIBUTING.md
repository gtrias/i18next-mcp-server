# Contributing to i18next MCP Server

Thank you for your interest in contributing to the i18next MCP Server! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- Git

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/gtrias/i18next-mcp-server.git
   cd i18next-mcp-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 🛠️ Development Workflow

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Lint code
npm run lint

# Format code
npm run format
```

### Testing

- Write tests for new features and bug fixes
- Ensure all tests pass before submitting PR
- Aim for good test coverage

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Building

```bash
# Build once
npm run build

# Build and watch for changes
npm run build:watch
```

## 📝 Contribution Guidelines

### Reporting Issues

When reporting issues, please include:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node.js version, OS, etc.)
- Relevant configuration files

### Feature Requests

For feature requests:

- Describe the use case and problem it solves
- Provide examples of how it would be used
- Consider backward compatibility

### Pull Requests

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow existing code style
   - Add tests for new functionality
   - Update documentation if needed

3. **Test your changes**
   ```bash
   npm test
   npm run lint
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `test:` for test additions/changes
   - `refactor:` for code refactoring
   - `chore:` for maintenance tasks

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### PR Requirements

- [ ] Tests pass
- [ ] Code is properly formatted
- [ ] Documentation is updated
- [ ] Commit messages follow conventional format
- [ ] No breaking changes (or clearly documented)

## 🏗️ Project Structure

```
src/
├── core/              # Core functionality
│   ├── config.ts      # Configuration management
│   └── file-manager.ts # File operations
├── health/            # Health checking
├── management/        # Key management
├── reporting/         # Analytics and reporting
├── automation/        # Scanner integration
├── types/             # TypeScript definitions
└── index.ts           # Main server entry point
```

## 🧪 Testing Guidelines

- Unit tests for individual functions/classes
- Integration tests for MCP tool workflows
- Test both success and error scenarios
- Mock external dependencies appropriately

## 📚 Documentation

When adding features:

- Update README.md if needed
- Add JSDoc comments for public APIs
- Include usage examples
- Update type definitions

## 🔄 Release Process

Releases are handled by maintainers:

1. Version bump following semver
2. Update CHANGELOG.md
3. Create GitHub release
4. Publish to npm

## 🤝 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Follow project guidelines

## 📞 Getting Help

- 📋 [GitHub Issues](https://github.com/gtrias/i18next-mcp-server/issues)
- 💬 [GitHub Discussions](https://github.com/gtrias/i18next-mcp-server/discussions)
- 📧 Email: dev@galleries.com

## 🙏 Recognition

All contributors will be recognized in the project's README and releases.

Thank you for contributing to i18next MCP Server! 🎉 