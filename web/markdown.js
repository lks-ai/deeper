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
   * parseMarkdown – convert markdown to HTML.
   *
   * @param {string} text - Markdown text.
   * @param {Object} options - Options (see Markdown constructor).
   * @return {string} HTML string.
   */
  function parseMarkdown(text, options) {
    // We'll work in multiple passes.
    // (Note: This implementation is simple and may not cover all edge cases.)

    // 1. Process code blocks (fenced with ```).
    text = text.replace(/```([\s\S]*?)```/g, function (match, code) {
      // Escape HTML inside code blocks.
      var esc = code.replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
      return '<pre><code>' + esc + '</code></pre>';
    });

    // 2. Process LaTeX display math: \[ ... \]
    text = text.replace(/\\\[((?:.|\n)*?)\\\]/g, function (match, math) {
      return '<div class="math-display">' + math.trim() + '</div>';
    });

    // 3. Process LaTeX inline math: \( ... \)
    text = text.replace(/\\\(((?:.|\n)*?)\\\)/g, function (match, math) {
      return '<span class="math-inline">' + math.trim() + '</span>';
    });

    // 4. Headings: Lines starting with one or more '#' characters.
    text = text.replace(/^(#{1,6})\s*(.+)$/gm, function (match, hashes, content) {
      var level = hashes.length;
      return '<h' + level + '>' + content.trim() + '</h' + level + '>';
    });

    // 5. Horizontal rules: lines containing at least 3 * or - characters.
    text = text.replace(/^\s*(\*{3,}|-{3,})\s*$/gm, '<hr>');

    // 6. Blockquotes: Lines starting with one or more '>' characters.
    text = text.replace(/^\s*>+\s?(.*)$/gm, function (match, content) {
      return '<blockquote>' + content.trim() + '</blockquote>';
    });

    // 7. Lists: We process unordered (-, +, *) and ordered (number.) lists.
    text = processLists(text);

    // 8. Tables: A simple table implementation (detects blocks with pipes).
    text = text.replace(/((?:\|.*\|(?:\n|$))+)/g, function (match, tableBlock) {
      var rows = tableBlock.trim().split('\n');
      // Look for a separator line in the second row.
      if (rows.length > 1 && rows[1].match(/^\s*\|?(?:\s*:?-+:?\s*\|)+\s*$/)) {
        var html = '<table>';
        // Header row.
        var headerCells = rows[0].split('|').map(function (cell) {
          return cell.trim();
        }).filter(function (cell) { return cell; });
        html += '<thead><tr>';
        headerCells.forEach(function (cell) {
          html += '<th>' + cell + '</th>';
        });
        html += '</tr></thead>';
        // Data rows.
        if (rows.length > 2) {
          html += '<tbody>';
          for (var r = 2; r < rows.length; r++) {
            var rowCells = rows[r].split('|').map(function (cell) {
              return cell.trim();
            }).filter(function (cell) { return cell; });
            if (rowCells.length) {
              html += '<tr>';
              rowCells.forEach(function (cell) {
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

    // 9. Inline code: `code`
    text = text.replace(/`([^`]+)`/g, function (match, code) {
      var esc = code.replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
      return '<code>' + esc + '</code>';
    });

    // 10. Links: [text](url "optional title")
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, function (match, linkText, url, title) {
      var titleAttr = title ? ' title="' + title + '"' : '';
      return '<a target="_blank" href="' + url + '"' + titleAttr + '>' + linkText + '</a>';
    });

    // 11. Images: ![alt text](url "optional title")
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, function (match, alt, url, title) {
      var titleAttr = title ? ' title="' + title + '"' : '';
      return '<img src="' + url + '" alt="' + alt + '"' + titleAttr + ' />';
    });

    // 12. Bold text: **text** or __text__
    text = text.replace(/(\*\*|__)(.*?)\1/g, function (match, delim, content) {
      // If the user provided custom prefix/suffix or a replacer function, use that.
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

    // 13. Italic text: *text* or _text_
    // (Simple: we don’t try to disambiguate from bold here.)
    text = text.replace(/(\*|_)(.*?)\1/g, function (match, delim, content) {
      return '<em>' + content + '</em>';
    });

    // 14. Paragraphs: Wrap blocks that aren’t already block-level elements.
    text = text.split(/\n{2,}/).map(function (block) {
      // If block already starts with a block-level tag, don’t wrap.
      if (block.match(/^\s*<(h\d|ul|ol|pre|blockquote|table|div|img|p|code|hr)/)) {
        return block;
      }
      return '<p>' + block.trim() + '</p>';
    }).join('\n\n');

    return text;
  }

  /**
   * processLists – process markdown lists (both unordered and ordered).
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
  return Markdown;
}));
