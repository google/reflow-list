import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

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
});
