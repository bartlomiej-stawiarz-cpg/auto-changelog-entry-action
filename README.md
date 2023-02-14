# Auto Changelog Entry Action
Automatically adds a changelog entry to a file when a PR is merged.
To ensure that it works properly, add a proper trigger to your workflow (see example below).

## Inputs

### `config-file`

**Optional**: Path to the configuration file relative to the repository. Default: `.github/auto_changelog_config.yml`.

### `ignore-label`

**Optional**: Pull request's label that - when present - causes the action to skip adding new entry to the changelog. Default: `''`.


## Example usage

```yaml
uses: actions/auto-changelog-entry-action@v1.0
with:
    config-file: '.github/auto_changelog_config.yml'
    ignore-label: 'skip-changelog'
```

## Configuration

### Configuration keys

#### `changelog-file-path`

Path to the changelog file relative to the root of the repository. 
Default: `CHANGELOG.MD`

#### `template`

Template for the changelog message to be used in Markdown. It supports following built-in variables:

- `$CL_AUTHOR$` - username of the author of the pull request
- `$CL_AUTHOR_URL$` - HTTP URL to the profile of the pull request's author
- `$CL_TITLE$` - title of the pull request
- `$CL_NUMBER$` - number of the pull request
- `$CL_URL$` - HTTP URL of the pull request
- `$CL_MERGED_BY$` - username of the person who merged the pull request
- `$CL_MERGED_BY_URL$` - HTTP URL to the profile of the person who merged the pull request

There are two ways of defining custom variables:

- using label groups - each defined label group's value is then available through `$CL_LABEL_XXX$` variable, where *XXX* is the label group's id
- using config table - variables are available using `$CL_XXX$` syntax, where *XXX* is the entry's key

Default: `$CL_TITLE$`

#### `label-groups`

Label groups is a mechanism that allows for variables definitions based on labels assigned to the PR.
Keys used for a label group definition:

- `id` - unique id of the group, used for variable's name generation
- `labels` - either an array of exact labels that should be grouped under this label group or a string that the considered labels begin with
- `type` - type of the group - either *combined* which applies the prefix and suffix only once or *separate* which applies the prefix to each label separately
- `separator` - string to separate the labels with (after applying the prefix and the suffix)
- `prefix` - prefix for the label or labels, depending on the *type*
- `suffix` - suffix for the label or labels, depending on the *type*
- `default` - default value to use if no labels belonging to the given label group are set
- `replacers` - definition of string replacements that should be performed on each label, one by one

Default: `[]`

### `Config table`

Config table lets you define any custom injectable variables.
They can be used by adding to a PR's description a standard Markdown table with two columns where the heading's first cell contains the word *Key* and the second cell contains the word *Value*.
If there are multiple tables present, only the first one is used.
In case of a name conflict with the built-in variables (eg. specifying a key *AUTHOR*), the variable will persist its default value.

Example:
```
| Key | Value |
| --- | --- |
| CRI | [CRI-13716](https://favro.com/organization/56851efba9d86382848cd889/2189191c43971636725e712c?card=cri-13716) |
| AUTHORS | John Jenkins, Adam Travis |
| EMOJI | :smiley: |
```

would set following additional variables:
- `$CL_CRI$` with the value `[CRI-13716](https://favro.com/organization/56851efba9d86382848cd889/2189191c43971636725e712c?card=cri-13716)`
- `$CL_AUTHORS$` with the value `John Jenkins, Adam Travis`
- `$CL_EMOJI$` with the value `:smiley:`


### Example config file

```yaml
template: '$CL_LABEL_TYPE$ $CL_LABEL_SKU$[[PR-$CL_NUMBER$]($CL_URL$)] [$CL_CRI$] $CL_TITLE$ by @$CL_AUTHOR$  '
label-groups:
  - id: 'type'
    labels: 'type/'
    type: separate
    prefix: '['
    suffix: ']'
    default: 'other'
    replacers:
      - from: 'type/'
        to: ''
  - id: 'sku'
    labels: 'sku/'
    type: combined
    prefix: '[sku: '
    suffix: '] '
    replacers:
      - from: 'sku/'
        to: ''
```

Eg.: Considering a PR with labels `sku/april-jigsaw`, `sku/jigsaw-lite`, `type/bug-fix` set and a config table where for the key `CRI` the value is set to `[CRI-13716](https://favro.com/organization/56851efba9d86382848cd889/2189191c43971636725e712c?card=cri-13716)`, the following entry will be added at the top of the CHANGELOG.MD file:  
```
[bug-fix] [sku: april-jigsaw,jigsaw-lite] [[PR-33](https://github.com/bartlomiej-stawiarz-cpg/test-actions/pull/33)] [[CRI-13716](https://favro.com/organization/56851efba9d86382848cd889/2189191c43971636725e712c?card=cri-13716)] Test with multiple SKUs by @bartlomiej-stawiarz-cpg  
```

## Example workflow
```yaml
name: Changelog updater

on:
  pull_request_target:
    branches: [ "main" ]
    types: [ closed ]

jobs:
  update-changelog:
    name: Update changelog
    runs-on: ubuntu-latest
    if: github.event.pull_request.merged == true

    steps:
      - uses: actions/checkout@v3
        with:
          ref: ${{ github.ref }}

      - name: Ensure changelog file exists
        run: touch CHANGELOG.md
        
      - run: ls -la
      
      - name: Add an entry to the changelog
        uses: bartlomiej-stawiarz-cpg/auto-changelog-entry-action@v0.1.0
        with:
          config-file: '.github/auto_changelog_config.yml'
          ignore-label: 'no-changelog'
        
      # Commit and push the changes, eg. using stefanzweifel/git-auto-commit-action
      - name: Commit and push changelog changes
        uses: stefanzweifel/git-auto-commit-action@v4
        with:
          commit_message: Updated changelog
          branch: ${{ github.ref }}
