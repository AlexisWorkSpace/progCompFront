import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';

const languageMap = {
  python: 'python',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
};

function CodeEditor({ language, value, onChange, editorRef }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = monaco.editor.create(containerRef.current, {
      value,
      language: languageMap[language] || 'python',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      roundedSelection: true,
      scrollBeyondLastLine: false,
    });

    editorRef.current = editor;

    editor.onDidChangeModelContent(() => {
      onChange(editor.getValue());
    });

    return () => editor.dispose();
  }, [language]);

  useEffect(() => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const model = editor.getModel();
      if (model && model.getValue() !== value) {
        editor.setValue(value);
      }
    }
  }, [value]);

  return <div className="editor-container" ref={containerRef} />;
}

export default CodeEditor;
