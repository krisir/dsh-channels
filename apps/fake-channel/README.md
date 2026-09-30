# @krischoichoi/app-fake-channel

Private end-to-end proof app for the dsh-channels monorepo.

Wires a fake channel adapter into a Cordis runtime and exercises the full loop
(`ChannelEvent` → SessionBinding → AgentRouter → reply pipeline) without a real
messaging platform or Harness runtime.

## Run

```bash
pnpm --filter @krischoichoi/app-fake-channel build
pnpm --filter @krischoichoi/app-fake-channel typecheck
pnpm --filter @krischoichoi/app-fake-channel test
```

## Related

- [Repository root](../../README.md)

## License

[MIT](../LICENSE)
