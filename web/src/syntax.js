/**
 * SyntaxHighlighter: A standalone, production‐ready JavaScript library for code highlighting.
 *
 * This library takes a string of code and a language name as input and outputs HTML code with
 * spans for each token. It supports modular language definitions and uses a uniform color scheme
 * (via CSS classes) for similar constructs across different languages.
 *
 * Usage:
 *   // Highlight some Python code:
 *   var html = SyntaxHighlighter.highlight(pythonCodeString, 'python');
 *
 *   // Register a new language definition:
 *   SyntaxHighlighter.registerLanguage('mylang', { patterns: [ ... ] });
 *
 * For production, include the accompanying CSS file to style the token classes (e.g., .sh-keyword, .sh-string, etc.).
 */
(function(global) {
    'use strict';
  
    // Utility: Escape HTML special characters.
    function escapeHtml(text) {
      return text.replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;");
    }
  
    // Registry for language definitions.
    var languages = {};
  
    /**
     * Register a language definition.
     * @param {string} name - The language name.
     * @param {Object} definition - An object with a "patterns" array.
     * Each pattern is an object { regex: RegExp, type: string }.
     */
    function registerLanguage(name, definition) {
      languages[name.toLowerCase()] = definition;
    }
  
    /**
     * Highlight a code string for a given language.
     * @param {string} code - The source code.
     * @param {string} langName - The language name.
     * @returns {string} - The HTML string with syntax highlighting.
     */
    function highlight(code, langName) {
      var lang = languages[langName.toLowerCase()];
      if (!lang) {
        // throw new Error('Language not registered: ' + langName);
        return code;
      }
  
      var tokens = [];
      var pos = 0;
      while (pos < code.length) {
        var substring = code.slice(pos);
        var matched = false;
        for (var i = 0; i < lang.patterns.length; i++) {
          var pat = lang.patterns[i];
          var m = pat.regex.exec(substring);
          if (m && m.index === 0) {
            tokens.push({
              text: m[0],
              type: pat.type
            });
            pos += m[0].length;
            matched = true;
            break;
          }
        }
        if (!matched) {
          // No pattern matched; output one character as plain text.
          tokens.push({
            text: code.charAt(pos),
            type: 'plain'
          });
          pos++;
        }
      }
  
      // Convert tokens to HTML, wrapping each token (except plain text) in a span.
      var html = '';
      tokens.forEach(function(token) {
        if (token.type === 'plain') {
          html += escapeHtml(token.text);
        } else {
          html += '<span class="sh-' + token.type + '">' + escapeHtml(token.text) + '</span>';
        }
      });
      return html;
    }
  
    // --- Language Definitions ---
  
    // Python language definition.
    registerLanguage('python', {
      patterns: [
        // Triple-quoted strings (both ''' and """)
        { regex: /^(?:'''[\s\S]*?'''|"""[\s\S]*?""")/, type: 'string' },
        // Single-quoted string.
        { regex: /^'(?:\\.|[^\\'])*'/, type: 'string' },
        // Double-quoted string.
        { regex: /^"(?:\\.|[^\\"])*"/, type: 'string' },
        // Comments.
        { regex: /^#.*(?=$|\n)/, type: 'comment' },
        // Keywords.
        { regex: new RegExp('^\\b(?:def|class|if|elif|else|for|while|return|import|from|as|pass|break|continue|in|and|or|not|is|None|True|False|try|except|finally|with|yield|lambda|global|nonlocal|assert|del|raise)\\b'), type: 'keyword' },
        // Numbers (integer and float).
        { regex: /^[0-9]+(?:\.[0-9]+)?\b/, type: 'number' },
        // Operators.
        { regex: /^[-+/*%=<>!&|^~]+/, type: 'operator' },
        // Punctuation.
        { regex: /^[()\[\]{}.,:;]/, type: 'punctuation' },
        // Identifiers (variables and function names).
        { regex: /^\b[a-zA-Z_]\w*\b/, type: 'variable' }
      ]
    });
  
    // JavaScript language definition.
    registerLanguage('javascript', {
      patterns: [
        // Multi-line comments.
        { regex: /^\/\*[\s\S]*?\*\//, type: 'comment' },
        // Single-line comments.
        { regex: /^\/\/.*(?=$|\n)/, type: 'comment' },
        // Template literals (backticks).
        { regex: /^`(?:\\.|[^\\`])*`/, type: 'string' },
        // Single-quoted string.
        { regex: /^'(?:\\.|[^\\'])*'/, type: 'string' },
        // Double-quoted string.
        { regex: /^"(?:\\.|[^\\"])*"/, type: 'string' },
        // Keywords.
        { regex: new RegExp('^\\b(?:function|var|let|const|if|else|for|while|do|return|class|new|this|typeof|instanceof|switch|case|break|continue|default|throw|try|catch|finally|import|export|from|as|await|async|null|undefined|true|false)\\b'), type: 'keyword' },
        // Numbers.
        { regex: /^[0-9]+(?:\.[0-9]+)?\b/, type: 'number' },
        // Operators.
        { regex: /^[-+/*%=<>!&|^~]+/, type: 'operator' },
        // Punctuation.
        { regex: /^[()\[\]{}.,:;]/, type: 'punctuation' },
        // Identifiers.
        { regex: /^\b[a-zA-Z_$][\w$]*\b/, type: 'variable' }
      ]
    });
  
    // C++ language definition (basic example).
    registerLanguage('cpp', {
      patterns: [
        // Single-line comments.
        { regex: /^\/\/.*(?=$|\n)/, type: 'comment' },
        // Multi-line comments.
        { regex: /^\/\*[\s\S]*?\*\//, type: 'comment' },
        // String literals (double quotes).
        { regex: /^"(?:\\.|[^\\"])*"/, type: 'string' },
        // Character literals (single quotes).
        { regex: /^'(?:\\.|[^\\'])*'/, type: 'string' },
        // Keywords.
        { regex: new RegExp('^\\b(?:int|float|double|char|void|if|else|for|while|do|return|class|struct|namespace|using|public|private|protected|virtual|override|template|typename)\\b'), type: 'keyword' },
        // Numbers.
        { regex: /^[0-9]+(?:\.[0-9]+)?\b/, type: 'number' },
        // Operators.
        { regex: /^[-+/*%=<>!&|^~]+/, type: 'operator' },
        // Punctuation.
        { regex: /^[()\[\]{}.,:;]/, type: 'punctuation' },
        // Identifiers.
        { regex: /^\b[a-zA-Z_]\w*\b/, type: 'variable' }
      ]
    });
  
    // Rust language definition (basic example).
    registerLanguage('rust', {
      patterns: [
        // Single-line comments.
        { regex: /^\/\/.*(?=$|\n)/, type: 'comment' },
        // Multi-line comments.
        { regex: /^\/\*[\s\S]*?\*\//, type: 'comment' },
        // String literals.
        { regex: /^"(?:\\.|[^\\"])*"/, type: 'string' },
        // Character literals.
        { regex: /^'(?:\\.|[^\\'])*'/, type: 'string' },
        // Keywords.
        { regex: new RegExp('^\\b(?:fn|let|mut|if|else|match|while|for|in|loop|struct|enum|impl|trait|const|static|use|mod|pub)\\b'), type: 'keyword' },
        // Numbers.
        { regex: /^[0-9]+(?:\.[0-9]+)?\b/, type: 'number' },
        // Operators.
        { regex: /^[-+/*%=<>!&|^~]+/, type: 'operator' },
        // Punctuation.
        { regex: /^[()\[\]{}.,:;]/, type: 'punctuation' },
        // Identifiers.
        { regex: /^\b[a-zA-Z_]\w*\b/, type: 'variable' }
      ]
    });
  
    // Expose the public API.
    var SyntaxHighlighter = {
      highlight: highlight,
      registerLanguage: registerLanguage,
      languages: languages  // Exposed for inspection/extension if needed.
    };
  
    // Export for Node.js or attach to the global namespace.
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = SyntaxHighlighter;
    } else {
      global.SyntaxHighlighter = SyntaxHighlighter;
    }
  })(this);
  