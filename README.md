# Auto Changelog Entry Action
Automatically adds a changelog entry to a specified file when PR is merged.

## Inputs

### `changelog-file`

**Required**: The file where the changelog entry will be placed.


## Example usage

```yaml
uses: actions/auto-changelog-entry-action@v1.0
with:
    changelog-file: 'CHANGELOG.md'
```