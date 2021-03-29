// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors
  // (console.error) This line of code will only be executed once when your
  // extension is activated
  console.log('"reflowlist" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  context.subscriptions.push(vscode.commands.registerTextEditorCommand(
      'reflowlist.reflowParagraph', reflowParagraph));
}

// Holds intermediate data while we are building the text to reflow.
//
// Typical usage:
//    let rbuilder = new ReflowBuilder(/#/, /-/, currentLine);
//    while (!rbouilder.foundBegin) {
//      rbuilder.maybeAddLineBefore(line above);
//    }
//    while (!rbuilder.foundEnd) {
//      rbuilder.maybeAddLineAfter(line below);
//    }
//    replaceLinesBy(rbuilder.ReflowedLines());
class ReflowBuilder {
  // Constructor.  Arguments are:
  //
  // commentRegExp: the regular expression that matches a comment at beginning
  //   of line.  Should be prefixed with '^'.
  // listRegExp: A regular expression
  //   that matches a list element after the comment (if any).  Should be
  //   prefixed with '^'.
  constructor(
      private readonly commentRegExp: RegExp,
      private readonly listRegExp: RegExp,
      private readonly additionalParagraphEndings: RegExp,
      private readonly wrapColumn: number, currentLine: string) {
    this.firstLinePrefix = '';
    this.foundBegin = false;
    this.foundEnd = false;

    const [prefix, definitionElement, listElement, rest] =
        this.parseLine(currentLine);
    this.linePrefix = prefix;
    if (definitionElement) {
      this.foundBegin = true;
      this.firstLinePrefix = this.linePrefix + definitionElement;
      this.linePrefix += '  ';
    } else if (listElement) {
      this.foundBegin = true;
      this.firstLinePrefix = prefix + listElement;
      this.linePrefix += ' '.repeat(listElement.length);
    } else {
      this.linePrefix = prefix;
      this.firstLinePrefix = prefix;
    }
    this.text = rest;
  }

  // Parse a line.  Returns a four-element array:
  // 0: The comment + whitespace prefix.
  // 1: The definition list begin (i.e., what's before ';') if any.
  // 1: The list element, if any, plus following whitespace.  (This would only
  //    be for the first line.) 2: The text that needs to be reflowed.
  parseLine(line: string): string[] {
    // Pull off a leading comment.
    let prefix: string = '';
    let definitionElement: string = '';
    let listElement: string = '';
    const commentMatch = this.commentRegExp.exec(line);
    if (commentMatch) {
      prefix = commentMatch[0];
      line = line.substring(prefix.length);
    }

    // Pull off leading whitespace.
    let whitespaceMatch = /^\s+/.exec(line);
    if (whitespaceMatch) {
      prefix += whitespaceMatch[0];
      line = line.substring(whitespaceMatch[0].length);
    }

    // Pull off a list element or a definition, if present.
    const definitionMatch = /^\w+:\s+/.exec(line);
    if (definitionMatch) {
      definitionElement = definitionMatch[0];
      line = line.substring(definitionElement.length);
    } else {
      // We did not find a definition.  See if we found a list element.
      const listBeginMatch = this.listRegExp.exec(line);
      if (listBeginMatch) {
        listElement = listBeginMatch[0];
        line = line.substring(listElement.length);
        whitespaceMatch = /^\s+/.exec(line);
        if (whitespaceMatch) {
          listElement += whitespaceMatch[0];
          line = line.substring(whitespaceMatch[0].length);
        }
      }
    }

    // Strip a trailing newline off the line.
    if (line.endsWith('\n')) line = line.substring(0, line.length - 1);

    return [prefix, definitionElement, listElement, line];
  }

  // Add a line above the previous lines.
  maybeAddLineAbove(line: string): boolean {
    if (this.foundBegin)
      throw new Error('already found beginning, do not call maybeAddLineAbove');

    const [prefix, definitionElement, listElement, rest] = this.parseLine(line);
    if (rest === '') return false;
    if (this.additionalParagraphEndings.test(rest)) return false;
    if (definitionElement) {
      // Check for different indentation.
      if (this.linePrefix !== prefix + '  ') return false;

      this.foundBegin = true;
      this.firstLinePrefix = prefix + definitionElement;
    } else if (listElement) {
      // Check for different indentation.
      if (this.linePrefix !== prefix + ' '.repeat(listElement.length))
        return false;

      this.foundBegin = true;
      this.firstLinePrefix = prefix + listElement;
    } else {
      if (prefix !== this.linePrefix) return false;
    }

    this.text = rest + ' ' + this.text;
    return true;
  }

  // Add a line below the previous lines.
  maybeAddLineBelow(line: string): boolean {
    if (this.foundEnd)
      throw new Error('already found end, do not call maybeAddLineBelow again');

    const [prefix, definitionElement, listElement, rest] = this.parseLine(line);
    if (rest === '') return false;
    if (this.additionalParagraphEndings.test(rest)) return false;
    if (definitionElement || listElement) return false;
    if (prefix !== this.linePrefix) return false;

    this.text += ' ' + rest;
    return true;
  }

  // Call this when done to return the replacement lines for all the lines
  // successfully added.
  reflowedLines(): string {
    let result: string = this.firstLinePrefix;

    let column: number = this.firstLinePrefix.length;
    let firstWord: boolean = true;
    for (let word of this.text.split(/\s+/)) {
      if (firstWord) {
        result += word;
        column += word.length;
        firstWord = false;
      } else if (column + 1 + word.length > this.wrapColumn) {
        result += '\n' + this.linePrefix + word;
        column = this.linePrefix.length + word.length;
      } else {
        result += ' ' + word;
        column += 1 + word.length;
      }
    }
    result += '\n';
    return result;
  }

  // Where we build the text we are reflowing.  This is all the text, with
  // preceding comments/whitespace/list elements and newlines removed.
  private text: string;

  // The prefix of the first line.  This would be the leading comment
  // indicators, if any, followed by a list element or a definition begin, if
  // any.
  private firstLinePrefix: string;

  // The prefix of subsequent lines.  This would be the leading comment
  // indicators, if any, followed by enough whitespace so it is the same length
  // as firstLinePrefix.
  private linePrefix: string;

  // Whether we've found the beginning line of the paragraph.
  public foundBegin: boolean;

  // Whether we've found the end line of the paragraph.
  public foundEnd: boolean;
}

function reflowParagraph(
    editor: vscode.TextEditor, edit: vscode.TextEditorEdit): void {
  // Get our regular expressions.  These are sticky, i.e., they only match at
  // the beginning of the string (because lastIndex starts out at 0).
  const config = vscode.workspace.getConfiguration('reflowlist');

  let rbuilder = new ReflowBuilder(
      new RegExp('^' + config.get<string>('commentRegexp') as string),
      new RegExp('^' + config.get<string>('listStartRegexp') as string),
      new RegExp(
          '^' + config.get<string>('additionalParagraphEndings') as string),
      config.get<number>('wrapColumn') as number,
      editor.document.lineAt(editor.selection.active).text);

  // Go up until we find the beginning of this paragraph.
  let firstLine: vscode.Position = editor.selection.active.with(undefined, 0);
  while (!rbuilder.foundBegin && firstLine.line > 0) {
    let prevLine = firstLine.translate(-1, 0);
    if (!rbuilder.maybeAddLineAbove(editor.document.lineAt(prevLine).text))
      break;
    firstLine = prevLine;
  }

  // Go down until we find the end of the paragraph.
  let lastLine: vscode.Position =
      editor.selection.active.with(undefined, 0).translate(1, 0);
  while (!rbuilder.foundEnd && lastLine.line < editor.document.lineCount) {
    if (!rbuilder.maybeAddLineBelow(editor.document.lineAt(lastLine).text))
      break;
    lastLine = lastLine.translate(1, 0);
  }

  // Replace this entire paragraph by the reformatted result.
  edit.delete(new vscode.Range(firstLine, lastLine));
  edit.insert(firstLine, rbuilder.reflowedLines());
}

// Called when extension is deactivated.
export function deactivate() {}
