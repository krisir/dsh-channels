# @krischoichoi/channel-testkit

Contract tests, fakes, fixture loader and E2E helpers for DeepSeek Harness
channel adapters.

Use this package to verify that a third-party (or built-in) adapter satisfies
the `ChannelAdapter` contract **without** touching real platforms or Harness
internals.

## Install

```bash
pnpm add -D @krischoichoi/channel-testkit
```

## What's inside

| Export | Purpose |
| --- | --- |
| `runChannelAdapterContract` | Vitest suite covering the full `ChannelAdapter` contract |
| `FakeAdapter` | Minimal in-memory adapter for bridge/tool tests |
| `FakeUpstream` | Scriptable platform upstream fake |
| `FakeHarness` / `HarnessPort` | Minimal Harness-side surface exercised through the port |
| `resolveFixturesDir` / `validateFixture` / `FixtureCase` | Load and validate `fixtures/<channel>/*.json` cases |
| E2E helpers | Adapter lifecycle harnesses |

The testkit depends only on `@krischoichoi/channel-core` and cordis. It never imports
`channel-harness` or Harness internals.

## Usage

```ts
import { describe } from 'vitest';
import { runChannelAdapterContract } from '@krischoichoi/channel-testkit';
import { MyAdapter } from '../src/adapter.js';

describe('MyAdapter contract', () => {
  runChannelAdapterContract(new MyAdapter(config), {
    expectedDedup: true,
  });
});
```

Fixture loading:

```ts
import { resolveFixturesDir, validateFixture } from '@krischoichoi/channel-testkit/fixture-loader';

const fixture = JSON.parse(readFileSync(join(resolveFixturesDir(), 'telegram', 'text.json'), 'utf8'));
validateFixture(fixture);
```

## Development

```bash
pnpm --filter @krischoichoi/channel-testkit build
pnpm --filter @krischoichoi/channel-testkit typecheck
pnpm --filter @krischoichoi/channel-testkit test
```

## Related

- [Repository root](../../README.md)
- [Adapter authoring guide](../../docs/adapter-authoring.md)

## License

[MIT](../../LICENSE)
