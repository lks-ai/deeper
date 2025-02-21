"use strict";

/**
 * RHEmbed – Realtime Hierarchical Embeddings
 * A standalone vanilla JavaScript implementation for online learning
 * of a 128-dimensional embedding space from a hierarchical text corpus.
 * It uses multi-scale n-gram tokenization with subword regularization,
 * an online skip-gram–inspired training procedure with negative sampling,
 * and (optionally) WebGL acceleration for cosine similarity calculations.
 */

(function(window) {
  // Global namespace
  var RHEmbed = {};

  /*** Configuration & Hyperparameters ***/
  RHEmbed.config = {
    learningRate: 0.025,
    contextWindow: 2,
    negativeSamples: 5,
    subwordRegularizationProbability: 0.1,
    embeddingDim: 128,
    minTokenFrequency: 2 // for future vocabulary pruning
  };

  /*** Utility Functions ***/
  RHEmbed.utils = {
    sigmoid: function(x) {
      return 1 / (1 + Math.exp(-x));
    },
    dot: function(a, b) {
      var sum = 0;
      for (var i = 0; i < a.length; i++) {
        sum += a[i] * b[i];
      }
      return sum;
    },
    // Add two vectors: a = a + b
    add: function(a, b) {
      for (var i = 0; i < a.length; i++) {
        a[i] += b[i];
      }
    },
    // Scale vector v by factor s in place.
    scale: function(v, s) {
      for (var i = 0; i < v.length; i++) {
        v[i] *= s;
      }
    },
    // Creates a new zero vector
    zeroVector: function(dim) {
      return new Float32Array(dim);
    }
  };

  /*** Tokenizer Module ***/
  RHEmbed.Tokenizer = {
    /**
     * Tokenizes the given text into overlapping n-grams (n=1 to 5)
     * and applies subword regularization.
     */
    tokenize: function(text) {
      try {
        if (!text || typeof text !== "string") return [];
        text = text.normalize("NFC");
        var tokens = [];
        // Create n-grams for n=1 to 5
        for (var n = 1; n <= 5; n++) {
          for (var i = 0; i <= text.length - n; i++) {
            // Subword regularization: with a given probability, occasionally skip token
            if (Math.random() < RHEmbed.config.subwordRegularizationProbability) {
              if (Math.random() < 0.5) continue;
            }
            tokens.push(text.substr(i, n));
          }
        }
        // Always include reserved tokens
        tokens.push("<eof>");
        tokens.push("<empty>");
        return tokens;
      } catch (e) {
        console.error("Error in tokenization:", e);
        return [];
      }
    }
  };

  /*** Vocabulary Module ***/
  RHEmbed.Vocabulary = {
    // Map token -> { index: Number, frequency: Number }
    tokens: {},
    nextIndex: 0,
    addToken: function(token) {
      if (!token) return;
      if (!this.tokens.hasOwnProperty(token)) {
        this.tokens[token] = { index: this.nextIndex, frequency: 1 };
        // Initialize embeddings for this new token.
        RHEmbed.Model.initializeToken(this.nextIndex);
        this.nextIndex++;
      } else {
        this.tokens[token].frequency++;
      }
    },
    getIndex: function(token) {
      if (this.tokens.hasOwnProperty(token)) {
        return this.tokens[token].index;
      }
      return null;
    },
    // (Optional) Vocabulary pruning for low frequency tokens.
    prune: function() {
      for (var token in this.tokens) {
        if (this.tokens[token].frequency < RHEmbed.config.minTokenFrequency) {
          // For simplicity, we mark token as pruned.
          this.tokens[token].pruned = true;
        }
      }
    }
  };

  /*** Embedding Model Module ***/
  RHEmbed.Model = {
    inputEmbeddings: [],   // array of Float32Array vectors (one per token)
    outputEmbeddings: [],  // separate context embeddings
    /**
     * Initializes random embeddings for a token at the given index.
     */
    initializeToken: function(index) {
      var dim = RHEmbed.config.embeddingDim;
      var inputVec = new Float32Array(dim);
      var outputVec = new Float32Array(dim);
      for (var i = 0; i < dim; i++) {
        inputVec[i] = (Math.random() - 0.5) / dim;
        outputVec[i] = (Math.random() - 0.5) / dim;
      }
      this.inputEmbeddings[index] = inputVec;
      this.outputEmbeddings[index] = outputVec;
    },
    /**
     * Performs a skip-gram negative sampling update.
     * centerIndex: index of center token.
     * contextIndex: index of a positive context token.
     * negativeIndices: array of indices for negative samples.
     */
    update: function(centerIndex, contextIndex, negativeIndices) {
      try {
        var centerVec = this.inputEmbeddings[centerIndex];
        var dim = RHEmbed.config.embeddingDim;
        var learningRate = RHEmbed.config.learningRate;
        // Positive sample update
        var contextVec = this.outputEmbeddings[contextIndex];
        var dot = RHEmbed.utils.dot(centerVec, contextVec);
        var sigmoidPos = RHEmbed.utils.sigmoid(dot);
        var gradPos = learningRate * (1 - sigmoidPos);
        // Update center and context embeddings for positive sample.
        for (var i = 0; i < dim; i++) {
          var gradCenter = gradPos * contextVec[i];
          var gradContext = gradPos * centerVec[i];
          centerVec[i] += gradCenter;
          contextVec[i] += gradContext;
        }
        // Negative samples update (target = 0)
        for (var j = 0; j < negativeIndices.length; j++) {
          var negIndex = negativeIndices[j];
          var negVec = this.outputEmbeddings[negIndex];
          var dotNeg = RHEmbed.utils.dot(centerVec, negVec);
          var sigmoidNeg = RHEmbed.utils.sigmoid(dotNeg);
          var gradNeg = learningRate * (0 - sigmoidNeg);
          for (var i = 0; i < dim; i++) {
            var gradCenterNeg = gradNeg * negVec[i];
            var gradNegOut = gradNeg * centerVec[i];
            centerVec[i] += gradCenterNeg;
            negVec[i] += gradNegOut;
          }
        }
      } catch (e) {
        console.error("Error during model update:", e);
      }
    },
    /**
     * Returns the combined embedding for a token (average of input and output embeddings).
     */
    getCombinedEmbedding: function(index) {
      var inputVec = this.inputEmbeddings[index];
      var outputVec = this.outputEmbeddings[index];
      var combined = new Float32Array(RHEmbed.config.embeddingDim);
      for (var i = 0; i < RHEmbed.config.embeddingDim; i++) {
        combined[i] = (inputVec[i] + outputVec[i]) / 2;
      }
      return combined;
    }
  };

  /**
   * Samples negative token indices from the current vocabulary,
   * excluding the given index.
   */
  RHEmbed.sampleNegatives = function(excludeIndex, count) {
    var negatives = [];
    var vocabSize = RHEmbed.Vocabulary.nextIndex;
    if (vocabSize <= 1) return negatives;
    for (var i = 0; i < count; i++) {
      var neg;
      do {
        neg = Math.floor(Math.random() * vocabSize);
      } while (neg === excludeIndex);
      negatives.push(neg);
    }
    return negatives;
  };

  /*** WebGL Acceleration Module ***/
  RHEmbed.WebGLAccel = {
    available: false,
    gl: null,
    /**
     * Initializes WebGL if available.
     */
    init: function() {
      try {
        var canvas = document.createElement("canvas");
        var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (!gl) {
          console.warn("WebGL not available; using CPU for calculations.");
          this.available = false;
          return;
        }
        this.gl = gl;
        this.available = true;
        // For production, you could compile shader programs here to accelerate
        // vector/matrix operations. For this example, we'll accelerate only cosine similarity.
      } catch (e) {
        console.error("Error initializing WebGL:", e);
        this.available = false;
      }
    },
    /**
     * Computes cosine similarities between a query vector and each vector in embeddingMatrix.
     * If WebGL is available, a shader-based implementation could be used.
     * For this implementation, we use CPU calculations regardless.
     */
    computeCosineSimilarities: function(queryVec, embeddingMatrix) {
      var similarities = [];
      var qNorm = Math.sqrt(RHEmbed.utils.dot(queryVec, queryVec));
      for (var j = 0; j < embeddingMatrix.length; j++) {
        var vec = embeddingMatrix[j];
        var dot = RHEmbed.utils.dot(queryVec, vec);
        var vecNorm = Math.sqrt(RHEmbed.utils.dot(vec, vec));
        var cosSim = (qNorm * vecNorm) ? dot / (qNorm * vecNorm) : 0;
        similarities.push(cosSim);
      }
      return similarities;
    }
  };

  // Initialize WebGL acceleration (if available)
  try {
    RHEmbed.WebGLAccel.init();
  } catch (e) {
    console.error("WebGL acceleration init error:", e);
  }

  /*** Trainer Module ***/
  RHEmbed.Trainer = {
    /**
     * Trains the embedding model on a block of text.
     * This function tokenizes the text, updates the vocabulary,
     * and performs skip-gram training with negative sampling.
     */
    trainOnText: function(text) {
      try {
        var tokens = RHEmbed.Tokenizer.tokenize(text);
        // Add tokens to vocabulary
        for (var i = 0; i < tokens.length; i++) {
          RHEmbed.Vocabulary.addToken(tokens[i]);
        }
        // Skip-gram training: for each token, update context tokens
        var windowSize = RHEmbed.config.contextWindow;
        for (var i = 0; i < tokens.length; i++) {
          var centerToken = tokens[i];
          var centerIndex = RHEmbed.Vocabulary.getIndex(centerToken);
          if (centerIndex === null) continue;
          var start = Math.max(0, i - windowSize);
          var end = Math.min(tokens.length - 1, i + windowSize);
          for (var j = start; j <= end; j++) {
            if (j === i) continue;
            var contextToken = tokens[j];
            var contextIndex = RHEmbed.Vocabulary.getIndex(contextToken);
            if (contextIndex === null) continue;
            var negatives = RHEmbed.sampleNegatives(centerIndex, RHEmbed.config.negativeSamples);
            RHEmbed.Model.update(centerIndex, contextIndex, negatives);
          }
        }
      } catch (e) {
        console.error("Error during training on text:", e);
      }
    },
    /**
     * Trains the model on a node object. The node structure is:
     * { name, type, body, parent, children: [] }.
     * The text from the node is tokenized and used for training,
     * and its aggregated embedding is stored.
     */
    trainOnNode: function(node) {
      try {
        if (!node || typeof node !== "object") {
          throw new Error("Invalid node provided");
        }
        var text = "";
        if (node.name) text += node.name + " ";
        if (node.body) text += node.body;
        this.trainOnText(text);
        // Compute and store the node embedding.
        RHEmbed.NodeEmbeddings.addNode(node);
      } catch (e) {
        console.error("Error during training on node:", e);
      }
    }
  };

  /*** Node Embeddings Module ***/
  RHEmbed.NodeEmbeddings = {
    // Stores objects of the form { node: node, embedding: Float32Array }
    nodes: [],
    /**
     * Computes and adds the node embedding by averaging token embeddings.
     */
    addNode: function(node) {
      try {
        if (!node) throw new Error("Invalid node");
        var text = "";
        if (node.name) text += node.name + " ";
        if (node.body) text += node.body;
        var embedding = RHEmbed.Query.embedText(text);
        this.nodes.push({ node: node, embedding: embedding });
      } catch (e) {
        console.error("Error adding node embedding:", e);
      }
    },
    getAllEmbeddings: function() {
      return this.nodes.map(function(item) {
        return item.embedding;
      });
    },
    getNodes: function() {
      return this.nodes;
    }
  };

  /*** Query API Module ***/
  RHEmbed.Query = {
    /**
     * Embeds a text string into the 128-dimensional vector space
     * by tokenizing it and averaging the corresponding token embeddings.
     */
    embedText: function(text) {
      try {
        var tokens = RHEmbed.Tokenizer.tokenize(text);
        var dim = RHEmbed.config.embeddingDim;
        var sumVec = RHEmbed.utils.zeroVector(dim);
        var count = 0;
        for (var i = 0; i < tokens.length; i++) {
          var token = tokens[i];
          var index = RHEmbed.Vocabulary.getIndex(token);
          if (index === null) continue;
          var emb = RHEmbed.Model.getCombinedEmbedding(index);
          for (var j = 0; j < dim; j++) {
            sumVec[j] += emb[j];
          }
          count++;
        }
        if (count > 0) {
          for (var j = 0; j < dim; j++) {
            sumVec[j] /= count;
          }
        }
        return sumVec;
      } catch (e) {
        console.error("Error embedding text:", e);
        return RHEmbed.utils.zeroVector(RHEmbed.config.embeddingDim);
      }
    },
    /**
     * Accepts a query string and returns the top N similar nodes
     * based on cosine similarity between the query embedding and stored node embeddings.
     */
    queryNodes: function(queryText, topN) {
      try {
        topN = topN || 5;
        var queryEmbedding = this.embedText(queryText);
        var nodesData = RHEmbed.NodeEmbeddings.getNodes();
        if (nodesData.length === 0) return [];
        var similarities = [];
        for (var i = 0; i < nodesData.length; i++) {
          var emb = nodesData[i].embedding;
          // Compute cosine similarity (using WebGLAccel if available, else CPU)
          var sim = RHEmbed.WebGLAccel.computeCosineSimilarities(queryEmbedding, [emb])[0];
          similarities.push({ node: nodesData[i].node, similarity: sim });
        }
        similarities.sort(function(a, b) {
          return b.similarity - a.similarity;
        });
        return similarities.slice(0, topN);
      } catch (e) {
        console.error("Error in queryNodes:", e);
        return [];
      }
    }
  };

  // Expose RHEmbed globally
  window.RHEmbed = RHEmbed;
})(window);
