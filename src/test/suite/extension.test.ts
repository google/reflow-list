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
// limitations under the License.import * as assert from 'assert';

import * as assert from 'assert';
import * as vscode from 'vscode';
import { tabsToSpaces } from '../../extension';

suite('Tabs to spaces suite', () => {
  test('2 column tabs', (done) => {
    assert.strictEqual(tabsToSpaces('\t\tx', 2), '    x');
    done();
  });

  test('4 column tabs', (done) => {
    assert.strictEqual(tabsToSpaces('\t\tx', 4), '        x');
    done();
  });

  test('4 column tabs, not tab aligned', (done) => {
    assert.strictEqual(tabsToSpaces('\ty\tx', 4), '    y   x');
    done();
  });
});

// Takes an initial buffer and a line number, runs reflow on it, and verifies
// that we get the expected string.
function reflowDocument(
    initialDocument: string, line: number, expectedDocument: string,
    done: () => void): void {
  vscode.workspace.openTextDocument({content: initialDocument, language: 'any'})
      .then(
          (document) => {
            vscode.window.showTextDocument(document).then(
                (editor) => {
                  const pos = new vscode.Position(line, 0);
                  editor.selection = new vscode.Selection(pos, pos);
                  vscode.commands.executeCommand('reflowlist.reflowParagraph')
                      .then(
                          () => {
                            assert.strictEqual(
                                document.getText(), expectedDocument);
                            done();
                          },
                          (error) => {
                            assert.fail(error);
                            done();
                          });
                },
                (error) => {
                  assert.fail(error);
                  done();
                });
          },
          (error) => {
            assert.fail(error);
            done();
          });
}

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Simple reflow, no comments', (done) => {
    reflowDocument(
        `line1
line2
line3`,
        1, `line1 line2 line3
`,
        done);
  });

  test('Formats only current paragraph', (done) => {
    reflowDocument(
        `p1line1
p1line2
p1line3

p2line1
p2line2`,
        5, `p1line1
p1line2
p1line3

p2line1 p2line2
`,
        done);
  });

  test('Only description', (done) => {
    reflowDocument('abc:', 0, 'abc:\n', done);
  });
  test('Only list element', (done) => {
    reflowDocument('- ', 0, '- \n', done);
  });

  test('Format list', (done) => {
    reflowDocument(
        `1. list line 1
   which flows onto the next line
2. list line 2`,
        1, `1. list line 1 which flows onto the next line
2. list line 2`,
        done);
  });

  test('Format description', (done) => {
    reflowDocument(
        `param1: some text
  and some more text
param2: more text`,
        0, `param1: some text and some more text
param2: more text`,
        done);
  });

  test('C++ comment', (done) => {
    reflowDocument(
        `
    // some text
    // which needs wrapping
    //   othertext`,
        1, `
    // some text which needs wrapping
    //   othertext`,
        done);
  });

  test('Javadoc comment', (done) => {
    reflowDocument(`
   /*
    * @param xyz   this is a parameter with some descriptive text which is too long for one line
    *   and some more on the next line`, 2, `
   /*
    * @param xyz   this is a parameter with some descriptive text which is too
    *   long for one line and some more on the next line
`, done);
  });

  test('Markdown definition list', (done) => {
    reflowDocument(`
A grandiose topic
:  Some pedantic words that do not do the grandiose topic justice, and which are badly formatted.
:  Some more pedantic words.`, 2, `
A grandiose topic
:  Some pedantic words that do not do the grandiose topic justice, and which are
   badly formatted.
:  Some more pedantic words.`, done);
  });

  test('Python comment', (done) => {
    reflowDocument(
        `
    # a beautiful description
    # of a clever algorithm
    #    with some indented stuff`,
        1, `
    # a beautiful description of a clever algorithm
    #    with some indented stuff`,
        done);
  });

  // Test whether it stops at the triple-quote delimeted python comments.
  test('Python long comment', (done) => {
    reflowDocument(
        `
  otherstuff
  """
  Some paragraphs about
  a python function.
  """
  def my_function`,
        3, `
  otherstuff
  """
  Some paragraphs about a python function.
  """
  def my_function`,
        done);
  });

  test(' * as list marker', (done) => {
    reflowDocument(`
  some text
   * list element
     blah
   * another list element`, 2, `
  some text
   * list element blah
   * another list element`, done);
  });

  test(' * as multi line /* comment */', (done) => {
    reflowDocument(`
    /*
     * some text
     * that needs to be reflowed.
     */`, 2, `
    /*
     * some text that needs to be reflowed.
     */`, done);
  });


  test('markdown block quote', (done) => {
    reflowDocument(`
  > Great quote from some
  > hallowed piece of literature.
  `, 1, `
  > Great quote from some hallowed piece of literature.
  `, done);
  });

});
