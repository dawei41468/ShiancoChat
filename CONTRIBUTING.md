# Contributing to ShiancoChat

Thank you for your interest in contributing! This document outlines the process and guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Security](#security)

## Code of Conduct

Be respectful, inclusive, and constructive in all interactions. Harassment or discriminatory behavior will not be tolerated.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/ShiancoChat.git`
3. Create a branch for your work: `git checkout -b feature/your-feature-name`

Use descriptive branch names:
- `feature/description` for new features
- `fix/description` for bug fixes
- `docs/description` for documentation changes
- `refactor/description` for code refactoring

## Development Setup

### Prerequisites

- Python 3.12+
- Node.js 20+
- Yarn 1.x
- MongoDB 6.0+ (or use mongomock for testing)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your settings
python server.py
```

The backend will start at `http://localhost:4100`.

### Frontend

```bash
cd frontend
yarn install
cp .env.example .env
# Edit .env with your settings
yarn start
```

The frontend will start at `http://localhost:4141`.

## Making Changes

### Before You Start

- Check existing issues and PRs to avoid duplicate work
- For significant changes, open an issue first to discuss the approach

### Commit Messages

Use clear, concise commit messages in the present tense:

```
Add user pagination to list endpoints
Fix race condition in embedding background task
Update README with troubleshooting steps
```

### Documentation

- Update `CHANGELOG.md` under the `[Unreleased]` section
- Update relevant documentation if behavior changes
- Add JSDoc to new frontend functions/components
- Add docstrings to new backend functions

## Testing

All changes must include tests. Run the full test suite before submitting:

### Backend Tests

```bash
cd backend
source venv/bin/activate
pytest tests/ -q
```

### Frontend Tests

```bash
cd frontend
yarn test --watchAll=false
```

### Build Verification

```bash
cd frontend
yarn build
```

## Submitting Changes

1. Ensure all tests pass
2. Update documentation as needed
3. Push your branch: `git push origin feature/your-feature-name`
4. Open a Pull Request against the `main` branch
5. Fill out the PR template with:
   - Description of changes
   - Motivation / problem being solved
   - Testing performed
   - Screenshots (for UI changes)

### PR Review Process

- A maintainer will review your PR within a few days
- Address review feedback promptly
- Once approved, a maintainer will merge your PR

## Coding Standards

### Python (Backend)

- Follow PEP 8
- Use type hints for function signatures
- Use Pydantic models for request/response validation
- Use `async`/`await` for I/O-bound operations
- Keep functions focused and under 50 lines where practical
- Import order: stdlib → third-party → local

### JavaScript/React (Frontend)

- Use functional components with hooks
- Destructure props at the component level
- Use Tailwind CSS for styling
- Keep components under 200 lines; extract sub-components as needed
- Use `const` and `let`; avoid `var`
- Prefer `async/await` over raw promises

## Security

- Never commit secrets, API keys, or credentials
- Use environment variables for sensitive configuration
- Report security vulnerabilities privately to maintainers
- Follow the principle of least privilege

## Questions?

Open an issue with the `question` label or reach out to maintainers.
