# reflowlist

reflowList is an extension for reflowing (wrapping) text that might have lists,
whether numeric lists, bulleted lists, or definition lists. It correctly
handles comments in most languages. It is designed primarily for reflowing
comments in code.

## Features

reflowList provides a single command, `reflowlist.reflowParagraph`, which does
the reformatting.

`reflowParagraph` reformats the paragraph around the cursor, where "paragraph"
is defined as lines that have a common prefix and the same indentation.

reflowlist understands bulleted lists (marked by `-` or `o`), numbered or
lettered lists (`1.`, `a.`, `1)`, `a)`), and definition lists. If the list
element extends more than one line, the subsequent lines are indented properly.

This is best shown by example:

![reflow animation](reflow_animation.gif)

## Extension Settings

By default, the extension should support any language that has comments
beginning with `#` (perl/python/shell), `//` (C++, go, many other languages),
`///` (swift), or `--` (SQL). If you need support for another language, just set
`reflowlist.commentStartRegexp` appropriately. This is a regular vscode setting,
so it can be controlled on a per-language or per-workspace basis if you desire.

`reflowlist.wrapColumn` is how you control the column at which text is wrapped.
(This is how we produced the examples above, using a smaller `wrapColumn`.) By
default, this is just `editor.wordWrapColumn`.

There are a few configurable regular expressions for list start, definition list
start, etc.

## Known Issues

* reflowList may incorrectly think that a line that begins with a word followed
  by a colon is the first line of a definition list. This is a hazard of
  supporting definition lists; it was not obvious how to make it support
  definition lists without occasionally seeing them in the wrong place. You may
  have to fix up such paragraphs manually.

* reflowList does not support paragraphs where the first line is indented or
  out-dented; it assumes that any lines with different indentation belong to a
  different paragraph. This is normally what you want when editing code or
  markdown.

* reflowList converts tabs into spaces. Sorry if you actually wanted hard tabs.
  Hopefully you have a code reformatted (like gofmt) that can convert back.

* reflowList does not attempt to reflow /* comment */ lines where there is text
  on the opening line of the comment, e.g.,

  ```
  /* Some text
   * that needs reflowing */
  ```

  It will treat the first line as a separate paragraph from subsequent lines.
  You may have to fix such comments manually.

  However, it will correctly reflow multi-line /* comment */ where there is no
  text on the opening line, e.g.,

  ```
  /*
   * Some text
   * that needs reflowing
   */
  ```


## Release Notes

### 0.9.1

More languages, a few bug fixes.

### 0.5

Initial release.
