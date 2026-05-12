/**
 * Editor — Monaco-based code editor with line highlighting
 *
 * The `highlightLine` prop (1-indexed) causes the editor to
 * show a colored glyph-margin indicator and scroll to that line.
 */
import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  highlightLine: number | null; // 1-indexed source line to highlight
}

const RISCV_KEYWORDS = [
  'li', 'la', 'lw', 'sw', 'add', 'addi', 'sub', 'mul', 'div',
  'slli', 'srli', 'srai', 'and', 'or', 'xor', 'andi', 'ori', 'xori',
  'slt', 'sltu', 'slti', 'mv', 'neg', 'not', 'nop',
  'beq', 'bne', 'blt', 'bge', 'beqz', 'bnez', 'bltz', 'bgez', 'bgtz', 'blez',
  'j', 'jal', 'jalr', 'call', 'ret', 'ecall',
  'seqz', 'snez',
];

const RISCV_REGISTERS = [
  'zero','ra','sp','gp','tp',
  'a0','a1','a2','a3','a4','a5','a6','a7',
  't0','t1','t2','t3','t4','t5','t6',
  's0','s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11',
  'fp',
];

const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, highlightLine }) => {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register a custom RISC-V language for syntax highlighting
    monaco.languages.register({ id: 'riscv' });

    monaco.languages.setMonarchTokensProvider('riscv', {
      keywords: RISCV_KEYWORDS,
      registers: RISCV_REGISTERS,
      directives: ['.data', '.text', '.word', '.byte', '.globl', '.global', '.asciiz', '.space'],
      tokenizer: {
        root: [
          // Comments
          [/#.*$/, 'comment'],
          // Directives
          [/\.[a-zA-Z_]\w*/, 'keyword.directive'],
          // Labels (anything ending with :)
          [/[a-zA-Z_]\w*(?=\s*:)/, 'type.label'],
          // Numbers
          [/0x[0-9a-fA-F]+/, 'number.hex'],
          [/0b[01]+/, 'number.binary'],
          [/-?\d+/, 'number'],
          // Registers
          [/\b(zero|ra|sp|gp|tp|fp|[atsxSTAX]\d*)\b/, {
            cases: {
              '@registers': 'variable.register',
              '@default': 'identifier',
            }
          }],
          // Instructions
          [/[a-zA-Z_]\w*/, {
            cases: {
              '@keywords': 'keyword',
              '@default': 'identifier',
            }
          }],
          // Punctuation
          [/[,()[\]]/, 'delimiter'],
          // Strings
          [/"[^"]*"/, 'string'],
        ],
      },
    });

    // Define a dark theme for RISC-V
    monaco.editor.defineTheme('riscv-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'keyword.directive', foreground: 'C586C0' },
        { token: 'type.label', foreground: 'DCDCAA' },
        { token: 'variable.register', foreground: '9CDCFE' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'number.hex', foreground: 'B5CEA8' },
        { token: 'number.binary', foreground: 'B5CEA8' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'delimiter', foreground: 'D4D4D4' },
      ],
      colors: {
        'editor.background': '#0f1117',
        'editor.foreground': '#D4D4D4',
        'editorLineNumber.foreground': '#4a4a6a',
        'editorLineNumber.activeForeground': '#9D86E9',
        'editor.lineHighlightBackground': '#1a1a2e',
        'editorGutter.background': '#0f1117',
      },
    });

    monaco.editor.setTheme('riscv-dark');
  };

  // Update the highlighted line decoration
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    // Clear previous decorations
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);

    if (highlightLine !== null && highlightLine > 0) {
      decorationsRef.current = editor.deltaDecorations([], [
        {
          range: new monaco.Range(highlightLine, 1, highlightLine, 1),
          options: {
            isWholeLine: true,
            className: 'current-line-highlight',
            glyphMarginClassName: 'current-line-glyph',
            overviewRuler: {
              color: '#9D86E9',
              position: monaco.editor.OverviewRulerLane.Left,
            },
          },
        },
      ]);

      // Scroll to the highlighted line
      editor.revealLineInCenterIfOutsideViewport(highlightLine);
    }
  }, [highlightLine]);

  return (
    <div className="editor-container">
      <div className="panel-header">
        <span className="panel-icon">📝</span>
        <span>RISC-V Editor</span>
        <span className="panel-hint">Write RISC-V assembly, then press Assemble</span>
      </div>
      <Editor
        height="100%"
        language="riscv"
        value={value}
        onChange={(v) => onChange(v ?? '')}
        onMount={handleMount}
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          lineNumbers: 'on',
          glyphMargin: true,
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          tabSize: 4,
          insertSpaces: true,
          renderWhitespace: 'selection',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          padding: { top: 12 },
        }}
      />
    </div>
  );
};

export default CodeEditor;
