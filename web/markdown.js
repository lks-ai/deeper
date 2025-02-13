/*!
 * markdown.js – A standalone browser‐based Markdown parser with LaTeX support.
 * Supports headings, paragraphs, lists, tables, links, images, code blocks,
 * inline code, blockquotes, horizontal rules, LaTeX (inline & display), and
 * customizable rewriting (e.g. for bold text).
 *
 * Usage:
 *   // Using as a module:
 *   var md = new Markdown({ boldPrefix: '<a href="#">', boldSuffix: '</a>' });
 *   var html = md.render(yourMarkdownString);
 *
 *   // Or using the static API:
 *   var html = Markdown.render(yourMarkdownString, { boldReplacer: function(txt){ return '<strong>' + txt + '</strong>'; } });
 *
 * Include markdown.css in your page to get sensible default styling.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.Markdown = factory();
  }
}(this, function () {

  /**
   * Main Markdown constructor.
   *
   * @param {Object} options - Optional settings:
   *   - boldReplacer: a function (text) => string to process bold text.
   *   - boldPrefix / boldSuffix: strings to prepend/append to bold content.
   *     (If both are provided, these take precedence over boldReplacer.)
   */
  function Markdown(options) {
    this.options = options || {};
  }

  /**
   * Render a Markdown string into HTML.
   *
   * @param {string} markdownText - The markdown source.
   * @return {string} - The rendered HTML.
   */
  Markdown.prototype.render = function (markdownText) {
    return parseMarkdown(markdownText, this.options);
  };

  /**
   * A static helper so you can call Markdown.render(text, options) without instantiation.
   *
   * @param {string} markdownText - The markdown source.
   * @param {Object} options - See Markdown constructor.
   * @return {string} - The rendered HTML.
   */
  Markdown.render = function (markdownText, options) {
    return parseMarkdown(markdownText, options || {});
  };

  // --- Internal parser implementation ---

  /**
   * parseMarkdown – Convert markdown to HTML.
   *
   * This implementation first masks out fenced code blocks (multiline) so that
   * no additional markdown transformations are applied within them. It then
   * processes the rest of the markdown and finally unmasks the code blocks.
   *
   * @param {string} text - Markdown text.
   * @param {Object} options - Options (see Markdown constructor).
   * @return {string} HTML string.
   */
  function parseMarkdown(text, options) {
    // 0. Mask out fenced code blocks.
    var codeBlockMap = {};
    var codeBlockIndex = 0;
    // The regex expects three backticks, optional tag on the same line, then a newline.
    text = text.replace(/```([^\n]*)\n([\s\S]*?)```/g, function(match, tag, code) {
      var placeholder = "%%CODEBLOCK_" + codeBlockIndex++ + "%%";
      codeBlockMap[placeholder] = {
        lang: tag.trim(), // may be empty
        code: code
      };
      return placeholder;
    });

    // 1. Process LaTeX display math: \[ ... \]
    text = text.replace(/\\\[((?:.|\n)*?)\\\]/g, function(match, math) {
      return '<div class="math-display">' + math.trim() + '</div>';
    });

    // 2. Process LaTeX inline math: \( ... \)
    text = text.replace(/\\\(((?:.|\n)*?)\\\)/g, function(match, math) {
      return '<span class="math-inline">' + math.trim() + '</span>';
    });

    // 3. Headings: Lines starting with one or more '#' characters.
    text = text.replace(/^(#{1,6})\s*(.+)$/gm, function(match, hashes, content) {
      var level = hashes.length;
      return '<h' + level + '>' + content.trim() + '</h' + level + '>';
    });

    // 4. Horizontal rules: lines containing at least 3 * or - characters.
    text = text.replace(/^\s*(\*{3,}|-{3,})\s*$/gm, '<hr>');

    // 5. Blockquotes: Lines starting with one or more '>' characters.
    text = text.replace(/^\s*>+\s?(.*)$/gm, function(match, content) {
      return '<blockquote>' + content.trim() + '</blockquote>';
    });

    // 6. Lists: Process unordered (-, +, *) and ordered (number.) lists.
    text = processLists(text);

    // 7. Tables: A simple table implementation (detects blocks with pipes).
    text = text.replace(/((?:\|.*\|(?:\n|$))+)/g, function(match, tableBlock) {
      var rows = tableBlock.trim().split('\n');
      if (rows.length > 1 && rows[1].match(/^\s*\|?(?:\s*:?-+:?\s*\|)+\s*$/)) {
        var html = '<table>';
        var headerCells = rows[0].split('|').map(function(cell) { return cell.trim(); }).filter(function(cell){ return cell; });
        html += '<thead><tr>';
        headerCells.forEach(function(cell) {
          html += '<th>' + cell + '</th>';
        });
        html += '</tr></thead>';
        if (rows.length > 2) {
          html += '<tbody>';
          for (var r = 2; r < rows.length; r++) {
            var rowCells = rows[r].split('|').map(function(cell) { return cell.trim(); }).filter(function(cell) { return cell; });
            if (rowCells.length) {
              html += '<tr>';
              rowCells.forEach(function(cell) {
                html += '<td>' + cell + '</td>';
              });
              html += '</tr>';
            }
          }
          html += '</tbody>';
        }
        html += '</table>';
        return html;
      } else {
        return match;
      }
    });

    // 8. Inline code: Single backticks. Render as a span with styling.
    text = text.replace(/`([^`]+)`/g, function(match, code) {
      return '<span class="inline-code">' + escapeHtml(code) + '</span>';
    });

    // 9. Links: [text](url "optional title")
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, function(match, linkText, url, title) {
      var titleAttr = title ? ' title="' + title + '"' : '';
      return '<a href="' + url + '"' + titleAttr + '>' + linkText + '</a>';
    });

    // 10. Images: ![alt text](url "optional title")
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, function(match, alt, url, title) {
      var titleAttr = title ? ' title="' + title + '"' : '';
      return '<img src="' + url + '" alt="' + alt + '"' + titleAttr + ' />';
    });

    // 11. Bold text: **text** or __text__
    text = text.replace(/(\*\*|__)(.*?)\1/g, function(match, delim, content) {
      if ((options.boldPrefix || options.boldSuffix)) {
        var prefix = options.boldPrefix || '';
        var suffix = options.boldSuffix || '';
        return prefix + '<strong>' + content + '</strong>' + suffix;
      } else if (typeof options.boldReplacer === 'function') {
        return options.boldReplacer(content);
      } else {
        return '<strong>' + content + '</strong>';
      }
    });

    // 12. Italic text: *text* or _text_
    text = text.replace(/(\*|_)(.*?)\1/g, function(match, delim, content) {
      return '<em>' + content + '</em>';
    });

    // 13. Paragraphs: Wrap blocks that aren’t already block-level elements.
    text = text.split(/\n{2,}/).map(function(block) {
      if (block.trim().match(/^%%CODEBLOCK_\d+%%$/)) {
        return block.trim();
      }
      if (block.match(/^\s*<(h\d|ul|ol|pre|blockquote|table|div|img|p|code|hr)/)) {
        return block;
      }
      return '<p>' + block.trim() + '</p>';
    }).join('\n\n');

    // 14. Unmask the code blocks.
    for (var placeholder in codeBlockMap) {
      if (codeBlockMap.hasOwnProperty(placeholder)) {
        var cb = codeBlockMap[placeholder];
        var escapedCode = escapeHtml(cb.code);
        var titleBar = cb.lang ? '<div class="code-block-title">' + escapeHtml(cb.lang) + '</div>' : '';
        var codeHtml = '<div class="code-block-container">' +
                         titleBar +
                         '<button class="copy-btn" onclick="Markdown.copyCode(this)">Copy</button>' +
                         '<pre><code>' + escapedCode + '</code></pre>' +
                       '</div>';
        text = text.replace(placeholder, codeHtml);
      }
    }
    
    return text;
  }

  // Helper: Escape HTML special characters.
  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#39;");
  }

  /**
   * processLists – Process markdown lists (both unordered and ordered).
   *
   * @param {string} text - The markdown text.
   * @return {string} - The text with list blocks converted to HTML.
   */
  function processLists(text) {
    var lines = text.split('\n');
    var newLines = [];
    var listBuffer = [];
    var listType = null; // "ul" or "ol"

    function flushList() {
      if (listBuffer.length > 0) {
        newLines.push('<' + listType + '>');
        listBuffer.forEach(function (item) {
          newLines.push('<li>' + item.trim() + '</li>');
        });
        newLines.push('</' + listType + '>');
        listBuffer = [];
        listType = null;
      }
    }

    lines.forEach(function (line) {
      var ulMatch = line.match(/^\s*([-+*])\s+(.*)$/);
      var olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
      if (ulMatch) {
        if (listType && listType !== 'ul') { flushList(); }
        listType = 'ul';
        listBuffer.push(ulMatch[2]);
      } else if (olMatch) {
        if (listType && listType !== 'ol') { flushList(); }
        listType = 'ol';
        listBuffer.push(olMatch[1]);
      } else {
        flushList();
        newLines.push(line);
      }
    });
    flushList();
    return newLines.join('\n');
  }

  // Expose the Markdown constructor.
  // Additionally, add a helper for copying code blocks.
  Markdown.copyCode = function(btn) {
    var container = btn.parentNode;
    var codeElem = container.querySelector('pre code');
    if (codeElem) {
      var textToCopy = codeElem.textContent;
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy).then(function() {
          var originalText = btn.textContent;
          btn.textContent = "Copied!";
          setTimeout(function() {
            btn.textContent = originalText;
          }, 2000);
        }, function(err) {
          console.error("Could not copy text: ", err);
        });
      } else {
        // Fallback for older browsers.
        var textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        textarea.style.position = "fixed";  // Prevent scrolling.
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
          document.execCommand('copy');
          var originalText = btn.textContent;
          btn.textContent = "Copied!";
          setTimeout(function() {
            btn.textContent = originalText;
          }, 2000);
        } catch (err) {
          console.error("Fallback: Unable to copy", err);
        }
        document.body.removeChild(textarea);
      }
    }
  };

  return Markdown;
}));
