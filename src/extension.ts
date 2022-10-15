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
  console.log('"reflowlist" is now active');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  context.subscriptions.push(vscode.commands.registerTextEditorCommand(
      'reflowlist.reflowParagraph', reflowParagraph));
}

// Convert tabs to spaces in a string.
export function tabsToSpaces(text: string, tabSize: number): string {
  for (let match = /\t/.exec(text); match; match = /\t/.exec(text)) {
    const nextTabPos = tabSize * (1 + Math.floor(match.index / tabSize));
    text = text.substr(0, match.index) +
        ' '.repeat(nextTabPos - match.index) +
        text.substr(match.index + 1);
  }
  return text;
}

// Determines if we are in the middle of a multi-line /* ... */ style comment.
// If the current line begins with ' * ', we look backwards until we either stop
// seeing lines that begin with ' * ' or we see a '/*'. We could look forward
// for the closing */, too, but it seems not unlikely that a user might be
// entering a commend and not have added it yet.
function inMultiLineStarSlashComment(
    document: vscode.TextDocument, line: number): boolean {
  if (!/^\s*\*\s+/.test(document.lineAt(line).text)) return false;

  // Look backwards until we find a /* or no more lines beginning with ' * '.
  while (line > 0) {
    --line;
    const lineText = document.lineAt(line).text;
    if (/^\s*\/\*/.test(lineText)) return true;
    if (!/^\s*\*\s+/.test(lineText)) return false;
  }
  return false;
}

// This is a bag of data that holds the parameters we fetch from the extension
// config.  There are a bunch of them; this class fetches them all at once.
class ReflowParameters {
  constructor(scope: vscode.ConfigurationScope) {
    const config = vscode.workspace.getConfiguration('reflowlist', scope);
    const comment = config.get<string>('commentRegexp') as string;
    const listStart = config.get<string>('listStartRegexp') as string;
    const additionalParagraphEndings =
        config.get<string>('additionalParagraphEndingsRegexp') as string;
    const definitionList = config.get<string>('definitionListRegexp') as string;
    if (!comment.startsWith('^') || !listStart.startsWith('^') ||
        !additionalParagraphEndings.startsWith('^') ||
        !definitionList.startsWith('^')) {
      throw new Error('All reflowList regular expressions must begin with ^');
    }
    if (!listStart.endsWith('\\s+') || !definitionList.endsWith('\\s+')) {
      throw new Error(
          'listStartRegexp and definitionListRegexp must end with \\s+');
    }

    this.commentMatcher = new RegExp(comment);
    this.listStartMatcher = new RegExp(listStart);
    this.additionalParagraphEndingsMatcher =
        new RegExp(additionalParagraphEndings);
    this.definitionListMatcher = new RegExp(definitionList);
    this.wrapColumn = config.get<number>('wrapColumn') as number;
    this.extraIndentForDescriptionList =
        config.get<number>('extraIndentForDescriptionList') as number;
    this.tabSize = vscode.workspace.getConfiguration('editor').get<number>(
                       'tabSize') as number;
  }
  public commentMatcher: RegExp;
  public listStartMatcher: RegExp;
  public additionalParagraphEndingsMatcher: RegExp;
  public definitionListMatcher: RegExp;
  public wrapColumn: number;
  public extraIndentForDescriptionList: number;
  public tabSize: number;
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
  // Public data members. Since there are so many of these, they are public so
  // they can be set up by using their names, and we don't have to have a
  // constructor with many arguments.

  // Constructor.  Arguments are:
  //
  // commentRegExp: the regular expression that matches a comment at beginning
  //   of line.  Should be prefixed with '^'.
  // listRegExp: A regular expression
  //   that matches a list element after the comment (if any).  Should be
  //   prefixed with '^'.
  constructor(private readonly params: ReflowParameters, currentLine: string) {
    this.firstLinePrefix = '';
    this.foundBegin = false;
    this.foundEnd = false;

    const [prefix, definitionElement, listElement, rest] =
        this.parseLine(currentLine);
    this.linePrefix = prefix;
    if (definitionElement) {
      this.foundBegin = true;
      this.firstLinePrefix = this.linePrefix + definitionElement;
      this.linePrefix += ' '.repeat(this.params.extraIndentForDescriptionList);
    } else if (listElement) {
      this.foundBegin = true;
      this.firstLinePrefix = prefix + listElement;
      this.linePrefix += ' '.repeat(listElement.length);
    } else {
      this.linePrefix = prefix;
      this.firstLinePrefix = prefix;
      if (rest === '') {
        this.foundBegin = true;
        this.foundEnd = true;
      }
    }

    // If we're on the ''' or ``` line, don't reflow at all.
    if (this.params.additionalParagraphEndingsMatcher.test(rest)) {
      this.foundBegin = true;
      this.foundEnd = true;
    }
    this.text = rest;
  }

  // Parse a line.  Returns a four-element array:
  // 0: The comment + whitespace prefix.
  // 1: The definition list begin (i.e., what's before ';') if any.
  // 2: The list element, if any, plus following whitespace. (This would only
  //    be for the first line.)
  // 3: The text that needs to be reflowed.
  parseLine(line: string): string[] {
    // Pull off a leading comment.
    let prefix: string = '';
    let definitionElement: string = '';
    let listElement: string = '';
    line = tabsToSpaces(line, this.params.tabSize);
    const commentMatch = this.params.commentMatcher.exec(line);
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
    const definitionMatch = this.params.definitionListMatcher.exec(line);
    if (definitionMatch) {
      definitionElement = definitionMatch[0];
      line = line.substring(definitionElement.length);
    } else {
      // We did not find a definition.  See if we found a list element.
      const listBeginMatch = this.params.listStartMatcher.exec(line);
      if (listBeginMatch) {
        listElement = listBeginMatch[0];
        line = line.substring(listElement.length);
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
    if (this.params.additionalParagraphEndingsMatcher.test(rest)) return false;
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
    if (this.params.additionalParagraphEndingsMatcher.test(rest)) return false;
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
      } else if (column + 1 + word.length > this.params.wrapColumn) {
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

  // Where we build the text we are reflowing. This is all the text, with
  // preceding comments/whitespace/list elements and newlines removed.
  private text: string;

  // The prefix of the first line. This would be the leading comment indicators,
  // if any, followed by a list element or a definition begin, if any.
  private firstLinePrefix: string;

  // The prefix of subsequent lines. This would be the leading comment
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
  // Get our regular expressions.
  let params = new ReflowParameters(editor.document);

  // If we're in a multi-line /* ... */ comment, then '*' is a comment
  // character. Otherwise, '*' is something that begins a list.
  if (inMultiLineStarSlashComment(
          editor.document, editor.selection.active.line)) {
    params.commentMatcher = /^\s*\*/;
  }

  let rbuilder = new ReflowBuilder(
      params, editor.document.lineAt(editor.selection.active).text);

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
