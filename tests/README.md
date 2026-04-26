# Firestore-rule unit tests

These tests run the actual `firestore.rules` against the Firebase
local emulator and assert what should and shouldn't be allowed.
**Run them locally before deploying any rule change** — Firestore
rules are easy to break and the consequences (cross-org data leaks
or every user locked out) are severe.

## One-time setup

The Firestore emulator is JVM-based, so it needs Java 17+ on your
PATH. On macOS:

```bash
brew install openjdk@17
sudo ln -sfn $(brew --prefix)/opt/openjdk@17/libexec/openjdk.jdk \
              /Library/Java/JavaVirtualMachines/openjdk-17.jdk
java -version  # should print "openjdk version 17..."
```

Everything else (firebase-tools, the rules-unit-testing SDK, vitest)
is already declared in `package.json`.

## Run

```bash
npm run test:rules
```

The script boots the emulator on port 8080, runs the test suite
against it, and shuts the emulator down. Total time: ~15–20s.

## What's covered

`tests/firestore.rules.test.js` asserts the highest-value invariants:

- Cross-org read isolation on activities, clients, users
- `/users/{uid}` self-update can't change `isAdmin` / `organizationId`
- Pilot-programme fields can only be written by host admins
- Activity reads enforce the `coverageUsers` scope for non-admins
- Invitations cannot be enumerated across orgs by non-members
- Host admin powers (cross-org read, privilege change)

If any of these fail, **do not deploy the rules**. Investigate the
failure first.

## When to add a test

Whenever you add or modify a rule that gates one role's access to
another role's data. Rule mistakes don't show up at build time, only
at runtime — usually when an external party finds the leak.
