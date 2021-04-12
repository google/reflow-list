# Change Log

All notable changes to the "reflowList" extension will be documented in this file.

## [0.5] - 2021-04

- Support Javadoc and markdown definition lists.
- Correctly handle '*' as a list element, since that is common in markdown; this
  requires special handling of /* */ comments.
- At least do something reasonable with tabs, so we can work with go code. gofmt
  can put the tabs back in if it really wants them.

## [0.4] - 2021-04

Alpha release.
