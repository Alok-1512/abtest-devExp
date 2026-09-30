# abtest-devExp

Developer-experience feature for an A/B testing platform: **`abctl`**, a CLI to log in, pull variant code to local files, edit in your own editor, and push it back with version-conflict detection. The backend is mocked with a local JSON file behind a `PlatformClient` interface, so swapping in a real API is a one-file change.

```
abctl/        the CLI, mock platform client, and dummy web dashboard
docs/PLAN.md  original build plan and interview talking points
```

See [abctl/README.md](abctl/README.md) for setup and the demo script.
