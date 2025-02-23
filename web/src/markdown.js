/*!
 * markdown.js – A standalone browser‐based Markdown parser with LaTeX support.
 * Supports headings, paragraphs, lists (with nested indentation and continuous numbering),
 * tables, links, images, code blocks, inline code, blockquotes, horizontal rules,
 * LaTeX (inline & display), and customizable rewriting (e.g. for bold text).
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

  // Helper function to tell if a url is a video
  function isVideoUrl(url) {
    const videoExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'];
    const videoHosts = ['youtube.com', 'vimeo.com'];

    // Check if the URL ends with a video extension
    const extensionMatch = videoExtensions.some(ext => url.endsWith(ext));

    // Check if the URL is hosted on a video host
    const hostMatch = videoHosts.some(host => url.includes(host));

    return extensionMatch || hostMatch;
  }

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
    // The regex expects three backticks, an optional tag on the same line, then a newline.
    text = text.replace(/```([^\n]*)\n([\s\S]*?)```/g, function(match, tag, code) {
      var placeholder = "%%CODEBLOCK_" + codeBlockIndex++ + "%%";
      codeBlockMap[placeholder] = {
        lang: tag.trim(), // may be empty
        code: code
      };
      return placeholder;
    });

    function safeFaTeX(math){
      if (FaTeX) return FaTeX.renderToString(math.trim());
        else return math.trim();
    }

    // 1. Process LaTeX display math: \[ ... \]
    text = text.replace(/\\\[((?:.|\n)*?)\\\]/g, function(match, math) {
      return '<div class="math-display">' + safeFaTeX(math) + '</div>';
    });

    // 2. Process LaTeX inline math: \( ... \)
    text = text.replace(/\\\(((?:.|\n)*?)\\\)/g, function(match, math) {
      return '<span class="math-inline">' + safeFaTeX(math) + '</span>';
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

    // 6. Process lists with nested indentation and continuous numbering.
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

    // 8. Inline code: Single backticks – rendered as a span.
    text = text.replace(/`([^`]+)`/g, function(match, code) {
      return '<span class="inline-code">' + escapeHtml(code) + '</span>';
    });

    // 9. Links: [text](url "optional title")
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, function(match, linkText, url, title) {
      var titleAttr = title ? ' title="' + title + '"' : '';
      // if it's not a hashtag based link
      let targetAttr = url[0] == '#' ? '': ` target="_blank"`;
      return '<a href="' + url + '"' + titleAttr + targetAttr + '>' + linkText + '</a>';
    });

    // 10. Images: ![alt text](url "optional title")
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, function(match, alt, url, title) {
      var titleAttr = title ? ' title="' + title + '"' : '';
      let elem = 'img';
      if (isVideoUrl(url)){
        elem = 'video';
      }
      return '<' + elem + ' src="' + url + '" alt="' + alt + '"' + titleAttr + ' />';
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
                         '<pre><code>' + SyntaxHighlighter.highlight(cb.code, cb.lang) + '</code></pre>' +
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
   * processLists – Process markdown lists with support for nested lists and continuous numbering.
   *
   * In this revised version we build a tree of list items. When a line with increased
   * indentation is encountered, it is attached as a nested list (child) of the previous item.
   *
   * @param {string} text - The markdown text.
   * @return {string} - The text with list blocks converted to HTML.
   */
  function processLists(text) {
    var lines = text.split('\n');
    var output = [];
    var stack = []; // Each element is a context: { indent, type, items }
    
    // Render a list context (or a nested list tree) into HTML.
    function renderList(ctx) {
      var tag = ctx.type === 'ol' ? 'ol' : 'ul';
      var html = '<' + tag + '>';
      ctx.items.forEach(function(item) {
        if (typeof item === "string") {
          html += '<li>' + item + '</li>';
        } else if (typeof item === "object") {
          // item is an object: { content, children }
          html += '<li>' + item.content;
          if (item.children && item.children.length > 0) {
            item.children.forEach(function(childCtx) {
              html += renderList(childCtx);
            });
          }
          html += '</li>';
        }
      });
      html += '</' + tag + '>';
      return html;
    }
    
    // Process each line.
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var unorderedMatch = line.match(/^(\s*)([-+*])\s+(.*)$/);
      var orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (unorderedMatch || orderedMatch) {
        var indent = (unorderedMatch ? unorderedMatch[1] : orderedMatch[1]).length;
        var type = unorderedMatch ? 'ul' : 'ol';
        var content = unorderedMatch ? unorderedMatch[3] : orderedMatch[3];
        
        // If no active list context, start one.
        if (stack.length === 0) {
          stack.push({ indent: indent, type: type, items: [ content ] });
        } else {
          var top = stack[stack.length - 1];
          if (indent > top.indent) {
            // New (nested) list: attach to the previous list item.
            // Ensure the previous item is an object.
            if (typeof top.items[top.items.length - 1] === "string") {
              top.items[top.items.length - 1] = { content: top.items[top.items.length - 1], children: [] };
            }
            // Push a new context for the nested list.
            stack.push({ indent: indent, type: type, items: [ content ] });
          } else {
            // Pop contexts until the top has indent less than or equal to current.
            while (stack.length > 0 && indent < stack[stack.length - 1].indent) {
              var completed = stack.pop();
              if (stack.length > 0) {
                // Attach the completed nested list as a child of the last item of the new top.
                var newTop = stack[stack.length - 1];
                if (typeof newTop.items[newTop.items.length - 1] === "string") {
                  newTop.items[newTop.items.length - 1] = { content: newTop.items[newTop.items.length - 1], children: [] };
                }
                newTop.items[newTop.items.length - 1].children.push(completed);
              } else {
                output.push(renderList(completed));
              }
            }
            // If the current level matches the top level and types differ, flush the top.
            if (stack.length > 0 && stack[stack.length - 1].indent === indent && stack[stack.length - 1].type !== type) {
              var completed = stack.pop();
              if (stack.length > 0) {
                var newTop = stack[stack.length - 1];
                if (typeof newTop.items[newTop.items.length - 1] === "string") {
                  newTop.items[newTop.items.length - 1] = { content: newTop.items[newTop.items.length - 1], children: [] };
                }
                newTop.items[newTop.items.length - 1].children.push(completed);
              } else {
                output.push(renderList(completed));
              }
              stack.push({ indent: indent, type: type, items: [ content ] });
            } else if (stack.length > 0 && stack[stack.length - 1].indent === indent) {
              // Same level: just add the item.
              stack[stack.length - 1].items.push(content);
            } else {
              // Otherwise, start a new context.
              stack.push({ indent: indent, type: type, items: [ content ] });
            }
          }
        }
      } else {
        // Non-list line: flush any active list contexts.
        while (stack.length > 0) {
          output.push(renderList(stack.pop()));
        }
        output.push(line);
      }
    }
    // Flush remaining contexts.
    if (stack.length > 0) {
      while (stack.length > 1) {
        var child = stack.pop();
        stack[stack.length - 1].items[stack[stack.length - 1].items.length - 1].children.push(child);
      }
      output.push(renderList(stack.pop()));
    }
    
    return output.join('\n');
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
