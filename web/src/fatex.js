/*!
 * FaTeX – Fast LaTeX Rendering Library
 * A standalone JavaScript library for rendering LaTeX math expressions to HTML.
 * Supports fractions (\frac{...}{...}), square roots (\sqrt{...}), superscripts (^),
 * subscripts (_), grouping with braces, scalable delimiters (\left ... \right),
 * and basic commands (e.g. \sin, \cos, \alpha, \times, \mathbf, \hat, \log, \sum, \min, \max, \hbar, \apos, etc.).
 *
 * Usage:
 *   // Get rendered HTML as a string:
 *   var html = FaTeX.renderToString("E=mc^2");
 *
 *   // Render directly into an element:
 *   FaTeX.render("E=mc^2", document.getElementById("math"));
 *
 * If a parse error is encountered, a warning is issued and the original string is wrapped in an error span.
 *
 * (c) 2025 Your Company Name. All rights reserved.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.FaTeX = factory();
  }
}(this, function () {

  // Mapping for commands to their Unicode/text equivalents.
  var commandMapping = {
    "alpha": "α", "beta": "β", "gamma": "γ", "delta": "δ",
    "epsilon": "ε", "zeta": "ζ", "eta": "η", "theta": "θ",
    "iota": "ι", "kappa": "κ", "lambda": "λ", "mu": "μ",
    "nu": "ν", "xi": "ξ", "omicron": "ο", "pi": "π",
    "rho": "ρ", "sigma": "σ", "tau": "τ", "upsilon": "υ",
    "phi": "φ", "chi": "χ", "psi": "ψ", "omega": "ω",
    "Gamma": "Γ", "Delta": "Δ", "Theta": "Θ", "Lambda": "Λ",
    "Xi": "Ξ", "Pi": "Π", "Sigma": "Σ", "Upsilon": "Υ",
    "Phi": "Φ", "Psi": "Ψ", "Omega": "Ω",
    "cdot": "⋅", "times": "×",
    "log": "log", "sum": "∑", "min": "min", "max": "max",
    "hbar": "ℏ", "apos": "’", "top": "⊤",
    "to": "→",
    "infty": "∞",
    "infinity": "∞", // optional alias if you expect \infinity too
    "ldots": "…"
  };

  /////////////////
  // Tokenizer
  /////////////////
  function tokenize(input) {
    var tokens = [];
    var i = 0;
    while (i < input.length) {
      var char = input[i];
      if (char === '\\') {
        // Check for \left and \right first.
        if (input.substr(i+1,4) === "left") {
          tokens.push({ type: "left", value: "\\left" });
          i += 5;
          continue;
        }
        if (input.substr(i+1,5) === "right") {
          tokens.push({ type: "right", value: "\\right" });
          i += 6;
          continue;
        }
        // Parse a general command: backslash + letters (or a single non-letter)
        var j = i + 1;
        var command = "";
        if (j < input.length && /[a-zA-Z]/.test(input[j])) {
          while (j < input.length && /[a-zA-Z]/.test(input[j])) {
            command += input[j];
            j++;
          }
        } else {
          command = input[j] || "";
          j++;
        }
        tokens.push({ type: "command", value: command });
        i = j;
      } else if (char === '{') {
        tokens.push({ type: "lbrace", value: "{" });
        i++;
      } else if (char === '}') {
        tokens.push({ type: "rbrace", value: "}" });
        i++;
      } else if (char === '^') {
        tokens.push({ type: "sup", value: "^" });
        i++;
      } else if (char === '_') {
        tokens.push({ type: "sub", value: "_" });
        i++;
      } else if ("+-*/=()[],".indexOf(char) >= 0) {
        tokens.push({ type: "operator", value: char });
        i++;
      } else if (/\s/.test(char)) {
        var ws = char;
        i++;
        while (i < input.length && /\s/.test(input[i])) {
          ws += input[i];
          i++;
        }
        tokens.push({ type: "whitespace", value: ws });
      } else {
        var text = char;
        i++;
        while (i < input.length && /[a-zA-Z0-9.,:;?!]/.test(input[i])) {
          text += input[i];
          i++;
        }
        tokens.push({ type: "text", value: text });
      }
    }
    return tokens;
  }

  /////////////////
  // Parser
  /////////////////
  function parseExpression(tokens) {
    var nodes = [];
    // Stop on closing brace or a \right (end of scalable group).
    while (tokens.length > 0 && tokens[0].type !== "rbrace" && tokens[0].type !== "right") {
      nodes.push(parseAtom(tokens));
    }
    if (nodes.length === 0) return { type: "text", value: "" };
    if (nodes.length === 1) return nodes[0];
    return { type: "row", content: nodes };
  }

  function parseAtom(tokens) {
    if (tokens.length === 0) {
      throw new Error("Unexpected end of input");
    }
    var token = tokens.shift();
    var node;
    if (token.type === "lbrace") {
      var content = parseExpression(tokens);
      if (tokens.length === 0 || tokens[0].type !== "rbrace") {
        throw new Error("Missing closing brace");
      }
      tokens.shift(); // consume rbrace
      node = { type: "group", content: content };
    } else if (token.type === "left") {
      node = parseScalableGroup(tokens);
    } else if (token.type === "command") {
      // Special handling for formatting commands that require an argument.
      if (token.value === "text") {
        if (tokens.length === 0 || tokens[0].type !== "lbrace") {
          throw new Error("Missing { after \\text");
        }
        tokens.shift(); // consume lbrace
        var content = parseExpression(tokens);
        if (tokens.length === 0 || tokens[0].type !== "rbrace") {
          throw new Error("Missing closing brace for \\text");
        }
        tokens.shift(); // consume rbrace
        node = { type: "textmode", content: content };
      } else if (token.value === "frac") {
        var numerator = parseAtom(tokens);
        var denominator = parseAtom(tokens);
        node = { type: "fraction", numerator: numerator, denominator: denominator };
      } else if (token.value === "sqrt") {
        var radicand = parseAtom(tokens);
        node = { type: "sqrt", radicand: radicand };
      } else if (token.value === "mathbf") {
        // Bold formatting: expect an argument.
        if (tokens.length === 0 || tokens[0].type !== "lbrace") {
          throw new Error("Missing { after \\mathbf");
        }
        tokens.shift();
        var content = parseExpression(tokens);
        if (tokens.length === 0 || tokens[0].type !== "rbrace") {
          throw new Error("Missing closing brace for \\mathbf");
        }
        tokens.shift();
        node = { type: "mathbf", content: content };
      } else if (token.value === "hat") {
        // Accent command: expect an argument.
        if (tokens.length === 0 || tokens[0].type !== "lbrace") {
          throw new Error("Missing { after \\hat");
        }
        tokens.shift();
        var base = parseExpression(tokens);
        if (tokens.length === 0 || tokens[0].type !== "rbrace") {
          throw new Error("Missing closing brace for \\hat");
        }
        tokens.shift();
        node = { type: "accent", accent: "hat", base: base };
      } else {
        // For other commands, create a command node.
        node = { type: "command", value: token.value };
      }
    } else if (token.type === "rbrace") {
      throw new Error("Unexpected closing brace");
    } else if (token.type === "sup" || token.type === "sub") {
      throw new Error("Unexpected " + token.type + " without a base");
    } else {
      node = { type: "text", value: token.value };
    }
    // Process optional superscript/subscript modifiers.
    while (tokens.length > 0 && (tokens[0].type === "sup" || tokens[0].type === "sub")) {
      var modToken = tokens.shift();
      var modNode;
      if (tokens[0] && tokens[0].type === "lbrace") {
        modNode = parseAtom(tokens);
      } else {
        modNode = parseAtom(tokens);
      }
      if (modToken.type === "sup") {
        node.sup = modNode;
      } else if (modToken.type === "sub") {
        node.sub = modNode;
      }
    }
    return node;
  }

  // Handles scalable groups using \left ... \right.
  function parseScalableGroup(tokens) {
    while (tokens.length > 0 && tokens[0].type === "whitespace") {
      tokens.shift();
    }
    if (tokens.length === 0) {
      throw new Error("Missing left delimiter after \\left");
    }
    var leftDelimToken = tokens.shift();
    var leftDelim = leftDelimToken.value;
    var content = parseExpression(tokens);
    if (tokens.length === 0 || tokens[0].type !== "right") {
      throw new Error("Missing \\right for \\left " + leftDelim);
    }
    tokens.shift(); // consume \right token
    while (tokens.length > 0 && tokens[0].type === "whitespace") {
      tokens.shift();
    }
    if (tokens.length === 0) {
      throw new Error("Missing right delimiter after \\right");
    }
    var rightDelimToken = tokens.shift();
    var rightDelim = rightDelimToken.value;
    return {
      type: "scalable",
      left: leftDelim,
      content: content,
      right: rightDelim
    };
  }

  function parse(tokens) {
    return parseExpression(tokens);
  }

  /////////////////
  // Renderer
  /////////////////
  function renderNode(node) {
    var html = "";
    switch (node.type) {
      case "text":
        html += '<span class="fatex-text">' + escapeHtml(node.value) + '</span>';
        break;
      case "row":
        node.content.forEach(function(child) {
          html += renderNode(child);
        });
        break;
      case "group":
        html += '<span class="fatex-group">' + renderNode(node.content) + '</span>';
        break;
      case "fraction":
        html += '<span class="fatex-fraction">' +
                  '<span class="fatex-numerator">' + renderNode(node.numerator) + '</span>' +
                  '<span class="fatex-fraction-line"></span>' +
                  '<span class="fatex-denominator">' + renderNode(node.denominator) + '</span>' +
                '</span>';
        break;
      case "sqrt":
        html += '<span class="fatex-sqrt">' +
                  '<span class="fatex-radical">&#8730;</span>' +
                  '<span class="fatex-radicand">' + renderNode(node.radicand) + '</span>' +
                '</span>';
        break;
      case "command":
        // If the command is in our mapping, render it accordingly.
        if (commandMapping[node.value] !== undefined) {
          // Special case for \, which should become a thin space.
          if (node.value === ",") {
            html += '<span class="fatex-thinspace">&thinsp;</span>';
          } else {
            html += '<span class="fatex-command">' + commandMapping[node.value] + '</span>';
          }
        } else {
          html += '<span class="fatex-command">' + escapeHtml("\\" + node.value) + '</span>';
        }
        break;
      case "scalable":
        html += '<span class="fatex-scalable">' +
                  '<span class="fatex-left-delimiter">' + escapeHtml(node.left) + '</span>' +
                  renderNode(node.content) +
                  '<span class="fatex-right-delimiter">' + escapeHtml(node.right) + '</span>' +
                '</span>';
        break;
      case "textmode":
        html += '<span class="fatex-textmode">' + renderNode(node.content) + '</span>';
        break;
      case "mathbf":
        html += '<span class="fatex-bold">' + renderNode(node.content) + '</span>';
        break;
      case "accent":
        if (node.accent === "hat") {
          html += '<span class="fatex-accent fatex-hat">' +
                    '<span class="fatex-accent-base">' + renderNode(node.base) + '</span>' +
                  '</span>';
        } else {
          html += '<span class="fatex-accent">' + renderNode(node.base) + '</span>';
        }
        break;
      default:
        html += '<span class="fatex-error">[Unknown node type]</span>';
    }
    if (node.sup || node.sub) {
      var base = html;
      html = '<span class="fatex-atom">' + base;
      if (node.sub) {
        html += '<sub class="fatex-sub">' + renderNode(node.sub) + '</sub>';
      }
      if (node.sup) {
        html += '<sup class="fatex-sup">' + renderNode(node.sup) + '</sup>';
      }
      html += '</span>';
    }
    return html;
  }

  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#39;");
  }

  // Public API: renderToString – converts a LaTeX math string to HTML.
  function renderToString(mathStr, options) {
    try {
      var tokens = tokenize(mathStr);
      var nodeTree = parse(tokens);
      return renderNode(nodeTree);
    } catch (e) {
      console.warn("FaTeX parse error:", e);
      return '<span class="fatex-error">' + escapeHtml(mathStr) + '</span>';
    }
  }

  // Public API: render – render to a DOM element.
  function render(mathStr, domElement, options) {
    domElement.innerHTML = renderToString(mathStr, options);
  }

  return {
    renderToString: renderToString,
    render: render
  };

}));
