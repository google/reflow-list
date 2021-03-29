# reflowlist

reflowList is an extension for reflowing (wrapping) text that might have lists,
whether numeric lists, bulletted lists, or definition lists. It correctly
handles comments in most languages.

## Features

reflowList provides a single command, `reflowlist.reflowParagraph`, which does
the reformatting.

`reflowParagraph` reformats the paragraph around the cursor, where "paragraph"
is defined as lines that have a common prefix and the same indentation.

reflowlist understands bulletted lists (marked by '-' or 'o'), numbered or
lettered lists ("1.", "a.", "1)", "a)"), and definition lists.  For example,

    // 1. First, do step one (eins, uno,
    //    etc.).
    // 2. Then, do step 2.

    # - Bleah
    # - Blah
    # - Blast

Definition lists (a single word followed by a colon) are particularly suitable
for explaining parameters to functions:

    Arguments:
      arg1: This is a a pretty important
        argument that you had better get
        right.
      arg2: This is a less important
        argument....

## Extension Settings

You can adjust the regular expressions that reflowlist uses to find comments and
lists and definition lists. You can also adjust the `wrapColumn` (the column at
which text is wrapped). (This is how the above examples were formatted.)

## Known Issues

reflowlist may incorrectly think that a line that begins with a word followed by
a colon is the first line of a definition list. This is a hazard; it was not
obvious how to make it support definition lists without occasionally seeing them
in the wrong place.

## Release Notes

### 0.0.1

First attempt.
