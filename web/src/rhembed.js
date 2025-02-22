"use strict";

/**
 * RHEmbed – Realtime Hierarchical Embeddings
 * A standalone vanilla JavaScript implementation for online learning
 * of a 128-dimensional embedding space from a hierarchical text corpus.
 * It uses multi-scale n-gram tokenization with subword regularization,
 * an online skip-gram–inspired training procedure with negative sampling,
 * and (optionally) WebGL acceleration for cosine similarity calculations.
 *
 * This hybrid version also incorporates a fixed teacher signal based on raw
 * n‑gram frequency distributions to guide early training. Guidance loss stats
 * are logged, and an optional query-time refinement function is provided.
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
    minTokenFrequency: 2,
    // For benchmarking (distribution-based query results)
    enableDistributionBenchmark: true,
    // Hybrid guidance settings:
    enableDistributionGuidance: true,
    guidanceLearningRate: 0.01,
    // When the tree grows to this many nodes, the guidance epsilon will be near 0
    distributionGuidanceDecayNodeCount: 1000,
    // Whether to log training statistics to console (for testing/debugging)
    logTrainingStats: true
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
    add: function(a, b) {
      for (var i = 0; i < a.length; i++) {
        a[i] += b[i];
      }
    },
    scale: function(v, s) {
      for (var i = 0; i < v.length; i++) {
        v[i] *= s;
      }
    },
    zeroVector: function(dim) {
      return new Float32Array(dim);
    },
    /**
     * Compute a normalized frequency distribution from text.
     * Returns an object mapping token -> normalized frequency.
     */
    computeNormalizedDistribution: function(text) {
      try {
        var tokens = RHEmbed.Tokenizer.tokenize(text);
        var freq = {};
        var total = 0;
        tokens.forEach(function(token) {
          freq[token] = (freq[token] || 0) + 1;
          total++;
        });
        for (var token in freq) {
          freq[token] /= total;
        }
        return freq;
      } catch (e) {
        console.error("Error computing normalized distribution:", e);
        return {};
      }
    },
    /**
     * Computes a similarity score between two normalized distributions.
     * Uses the dot-product (sum of token-wise products) as a proxy.
     */
    distributionSimilarity: function(dist1, dist2) {
      var sim = 0;
      for (var token in dist1) {
        if (dist2[token]) {
          sim += dist1[token] * dist2[token];
        }
      }
      return sim;
    },
    /**
     * Computes a guidance epsilon based on current tree size.
     * Uses logarithmic decay such that when the node count reaches
     * distributionGuidanceDecayNodeCount, epsilon is ~0.
     */
    computeGuidanceEpsilon: function() {
      var currentNodes = RHEmbed.NodeEmbeddings.nodes.length;
      var decayCount = RHEmbed.config.distributionGuidanceDecayNodeCount;
      var epsilon = 1 - (Math.log(currentNodes + 1) / Math.log(decayCount + 1));
      return Math.max(0, epsilon);
    },
    /**
     * Computes the L2 norm of a vector.
     */
    vectorNorm: function(vec) {
      return Math.sqrt(RHEmbed.utils.dot(vec, vec));
    }
  };

  /*** Tokenizer Module ***/
  RHEmbed.Tokenizer = {
    tokenize: function(text) {
      try {
        if (!text || typeof text !== "string") return [];
        text = text.normalize("NFC");
        var tokens = [];
        for (var n = 1; n <= 5; n++) {
          for (var i = 0; i <= text.length - n; i++) {
            if (Math.random() < RHEmbed.config.subwordRegularizationProbability) {
              if (Math.random() < 0.5) continue;
            }
            tokens.push(text.substr(i, n));
          }
        }
        tokens.push("<eof>");
        tokens.push("<empty>");
        return tokens;
      } catch (e) {
        console.error("Error in tokenization:", e);
        return [];
      }
    }
  };

  /*** Fixed Representations Module ***/
  RHEmbed.FixedRepresentations = {
    cache: {},
    /**
     * Returns a fixed 128-d vector for the given token using a hash-based PRNG.
     */
    getFixedEmbedding: function(token) {
      if (this.cache[token]) return this.cache[token];
      var dim = RHEmbed.config.embeddingDim;
      var vec = new Float32Array(dim);
      var seed = 0;
      for (var i = 0; i < token.length; i++) {
        seed = (seed * 31 + token.charCodeAt(i)) | 0;
      }
      var a = 1664525, c = 1013904223, m = 4294967296;
      var r = (seed >>> 0);
      for (var i = 0; i < dim; i++) {
        r = (a * r + c) % m;
        vec[i] = (r / m) * 2 - 1;
      }
      var norm = Math.sqrt(RHEmbed.utils.dot(vec, vec));
      for (var i = 0; i < dim; i++) {
        vec[i] /= norm;
      }
      this.cache[token] = vec;
      return vec;
    }
  };

  /*** Vocabulary Module ***/
  RHEmbed.Vocabulary = {
    tokens: {},
    nextIndex: 0,
    addToken: function(token) {
      if (!token) return;
      if (!this.tokens.hasOwnProperty(token)) {
        this.tokens[token] = { index: this.nextIndex, frequency: 1 };
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
    prune: function() {
      for (var token in this.tokens) {
        if (this.tokens[token].frequency < RHEmbed.config.minTokenFrequency) {
          this.tokens[token].pruned = true;
        }
      }
    }
  };

  /*** Embedding Model Module ***/
  RHEmbed.Model = {
    inputEmbeddings: [],
    outputEmbeddings: [],
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
    update: function(centerIndex, contextIndex, negativeIndices) {
      try {
        var centerVec = this.inputEmbeddings[centerIndex];
        var dim = RHEmbed.config.embeddingDim;
        var learningRate = RHEmbed.config.learningRate;
        var contextVec = this.outputEmbeddings[contextIndex];
        var dotVal = RHEmbed.utils.dot(centerVec, contextVec);
        var sigmoidPos = RHEmbed.utils.sigmoid(dotVal);
        var gradPos = learningRate * (1 - sigmoidPos);
        for (var i = 0; i < dim; i++) {
          var gradCenter = gradPos * contextVec[i];
          var gradContext = gradPos * centerVec[i];
          centerVec[i] += gradCenter;
          contextVec[i] += gradContext;
        }
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
    getCombinedEmbedding: function(index) {
      var inputVec = this.inputEmbeddings[index];
      var outputVec = this.outputEmbeddings[index];
      var combined = new Float32Array(RHEmbed.config.embeddingDim);
      for (var i = 0; i < RHEmbed.config.embeddingDim; i++) {
        combined[i] = (inputVec[i] + outputVec[i]) / 2;
      }
      return combined;
    },
    /**
     * Applies a guidance update to a token's embedding.
     */
    guidanceUpdate: function(tokenIndex, updateVector) {
      try {
        var dim = RHEmbed.config.embeddingDim;
        var inEmb = this.inputEmbeddings[tokenIndex];
        var outEmb = this.outputEmbeddings[tokenIndex];
        for (var i = 0; i < dim; i++) {
          inEmb[i] += updateVector[i];
          outEmb[i] += updateVector[i];
        }
      } catch (e) {
        console.error("Error in guidance update:", e);
      }
    }
  };

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
      } catch (e) {
        console.error("Error initializing WebGL:", e);
        this.available = false;
      }
    },
    computeCosineSimilarities: function(queryVec, embeddingMatrix) {
      var similarities = [];
      var qNorm = Math.sqrt(RHEmbed.utils.dot(queryVec, queryVec));
      for (var j = 0; j < embeddingMatrix.length; j++) {
        var vec = embeddingMatrix[j];
        var dotVal = RHEmbed.utils.dot(queryVec, vec);
        var vecNorm = Math.sqrt(RHEmbed.utils.dot(vec, vec));
        var cosSim = (qNorm * vecNorm) ? dotVal / (qNorm * vecNorm) : 0;
        similarities.push(cosSim);
      }
      return similarities;
    }
  };

  try {
    RHEmbed.WebGLAccel.init();
  } catch (e) {
    console.error("WebGL acceleration init error:", e);
  }

  /*** Trainer Module ***/
  RHEmbed.Trainer = {
    /**
     * Trains on a block of text using skip-gram updates.
     * Returns the token list.
     */
    trainOnText: function(text) {
      var tokens = [];
      try {
        tokens = RHEmbed.Tokenizer.tokenize(text);
        tokens.forEach(function(token) {
          RHEmbed.Vocabulary.addToken(token);
        });
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
      return tokens;
    },
    /**
     * Trains the model on a node.
     * After standard skip-gram training, if guidance is enabled,
     * the function computes a fixed-target embedding from token distributions
     * and applies a guidance update scaled by epsilon.
     * Training stats (epsilon and guidance loss) are logged.
     */
    trainOnNode: function(node) {
      try {
        if (!node || typeof node !== "object") {
          throw new Error("Invalid node provided");
        }
        var text = "";
        if (node.name) text += node.name + " ";
        if (node.body) text += node.body;
        var tokens = this.trainOnText(text);
        if (RHEmbed.config.enableDistributionGuidance) {
          var epsilon = RHEmbed.utils.computeGuidanceEpsilon();
          if (epsilon > 0) {
            var dim = RHEmbed.config.embeddingDim;
            var targetEmb = RHEmbed.utils.zeroVector(dim);
            tokens.forEach(function(token) {
              var fixedVec = RHEmbed.FixedRepresentations.getFixedEmbedding(token);
              for (var i = 0; i < dim; i++) {
                targetEmb[i] += fixedVec[i];
              }
            });
            for (var i = 0; i < dim; i++) {
              targetEmb[i] /= tokens.length;
            }
            var currentEmb = RHEmbed.Query.embedText(text);
            var error = new Float32Array(dim);
            for (var i = 0; i < dim; i++) {
              error[i] = targetEmb[i] - currentEmb[i];
            }
            var errorNorm = RHEmbed.utils.vectorNorm(error);
            if (RHEmbed.config.logTrainingStats) {
              console.log("Guidance epsilon:", epsilon.toFixed(3), " | Guidance Loss (L2 norm):", errorNorm.toFixed(5));
            }
            var freq = {};
            tokens.forEach(function(token) {
              freq[token] = (freq[token] || 0) + 1;
            });
            var total = tokens.length;
            for (var token in freq) {
              var tokenIndex = RHEmbed.Vocabulary.getIndex(token);
              if (tokenIndex === null) continue;
              var tokenWeight = freq[token] / total;
              var updateVec = new Float32Array(dim);
              for (var i = 0; i < dim; i++) {
                updateVec[i] = epsilon * RHEmbed.config.guidanceLearningRate * tokenWeight * error[i];
              }
              RHEmbed.Model.guidanceUpdate(tokenIndex, updateVec);
            }
          }
        }
        RHEmbed.NodeEmbeddings.addNode(node, text);
      } catch (e) {
        console.error("Error during training on node:", e);
      }
    }
  };

  /*** Node Embeddings Module ***/
  RHEmbed.NodeEmbeddings = {
    nodes: [],
    addNode: function(node, text) {
      try {
        if (!node) throw new Error("Invalid node");
        var embedding = RHEmbed.Query.embedText(text);
        var distribution = {};
        if (RHEmbed.config.enableDistributionBenchmark) {
          distribution = RHEmbed.utils.computeNormalizedDistribution(text);
        }
        this.nodes.push({ node: node, embedding: embedding, distribution: distribution });
      } catch (e) {
        console.error("Error adding node embedding:", e);
      }
    },
    getAllEmbeddings: function() {
      return this.nodes.map(function(item) { return item.embedding; });
    },
    getNodes: function() {
      return this.nodes;
    }
  };

  /*** Query API Module ***/
  RHEmbed.Query = {
    embedText: function(text) {
      try {
        var tokens = RHEmbed.Tokenizer.tokenize(text);
        var dim = RHEmbed.config.embeddingDim;
        var sumVec = RHEmbed.utils.zeroVector(dim);
        var count = 0;
        tokens.forEach(function(token) {
          var index = RHEmbed.Vocabulary.getIndex(token);
          if (index === null) return;
          var emb = RHEmbed.Model.getCombinedEmbedding(index);
          for (var i = 0; i < dim; i++) {
            sumVec[i] += emb[i];
          }
          count++;
        });
        if (count > 0) {
          for (var i = 0; i < dim; i++) {
            sumVec[i] /= count;
          }
        }
        return sumVec;
      } catch (e) {
        console.error("Error embedding text:", e);
        return RHEmbed.utils.zeroVector(RHEmbed.config.embeddingDim);
      }
    },
    queryNodes: function(queryText, topN) {
      try {
        topN = topN || 5;
        var queryEmbedding = this.embedText(queryText);
        var nodesData = RHEmbed.NodeEmbeddings.getNodes();
        if (nodesData.length === 0) return [];
        var similarities = [];
        nodesData.forEach(function(item) {
          var emb = item.embedding;
          var sim = RHEmbed.WebGLAccel.computeCosineSimilarities(queryEmbedding, [emb])[0];
          similarities.push({ node: item.node, similarity: sim });
        });
        similarities.sort(function(a, b) {
          return b.similarity - a.similarity;
        });
        return similarities.slice(0, topN);
      } catch (e) {
        console.error("Error in queryNodes:", e);
        return [];
      }
    },
    queryNodesDistribution: function(queryText, topN) {
      try {
        if (!RHEmbed.config.enableDistributionBenchmark) return [];
        topN = topN || 5;
        var queryDistribution = RHEmbed.utils.computeNormalizedDistribution(queryText);
        var nodesData = RHEmbed.NodeEmbeddings.getNodes();
        if (nodesData.length === 0) return [];
        var similarities = [];
        nodesData.forEach(function(item) {
          var sim = RHEmbed.utils.distributionSimilarity(queryDistribution, item.distribution);
          similarities.push({ node: item.node, similarity: sim });
        });
        similarities.sort(function(a, b) {
          return b.similarity - a.similarity;
        });
        return similarities.slice(0, topN);
      } catch (e) {
        console.error("Error in queryNodesDistribution:", e);
        return [];
      }
    },
    /**
     * Returns both model-based and distribution-based query results.
     */
    queryNodesCombined: function(queryText, topN) {
      return {
        modelResults: this.queryNodes(queryText, topN),
        distributionResults: this.queryNodesDistribution(queryText, topN)
      };
    },
    /**
     * (Optional) Refines the model using the query text.
     * This function runs a few extra epochs of guidance training on the query,
     * updating token embeddings to better align the model with the distribution.
     */
    refineWithQuery: function(queryText, epochs) {
      epochs = epochs || 1;
      for (var e = 0; e < epochs; e++) {
        // We use the same guidance update mechanism as in trainOnNode,
        // but without storing a new node.
        var tokens = RHEmbed.Tokenizer.tokenize(queryText);
        var epsilon = RHEmbed.utils.computeGuidanceEpsilon();
        if (epsilon <= 0) return;
        var dim = RHEmbed.config.embeddingDim;
        var targetEmb = RHEmbed.utils.zeroVector(dim);
        tokens.forEach(function(token) {
          var fixedVec = RHEmbed.FixedRepresentations.getFixedEmbedding(token);
          for (var i = 0; i < dim; i++) {
            targetEmb[i] += fixedVec[i];
          }
        });
        for (var i = 0; i < dim; i++) {
          targetEmb[i] /= tokens.length;
        }
        var currentEmb = RHEmbed.Query.embedText(queryText);
        var error = new Float32Array(dim);
        for (var i = 0; i < dim; i++) {
          error[i] = targetEmb[i] - currentEmb[i];
        }
        var errorNorm = RHEmbed.utils.vectorNorm(error);
        if (RHEmbed.config.logTrainingStats) {
          console.log("Query refinement epoch", e+1, "| epsilon:", epsilon.toFixed(3), "| loss:", errorNorm.toFixed(5));
        }
        var freq = {};
        tokens.forEach(function(token) {
          freq[token] = (freq[token] || 0) + 1;
        });
        var total = tokens.length;
        for (var token in freq) {
          var tokenIndex = RHEmbed.Vocabulary.getIndex(token);
          if (tokenIndex === null) continue;
          var tokenWeight = freq[token] / total;
          var updateVec = new Float32Array(dim);
          for (var i = 0; i < dim; i++) {
            updateVec[i] = epsilon * RHEmbed.config.guidanceLearningRate * tokenWeight * error[i];
          }
          RHEmbed.Model.guidanceUpdate(tokenIndex, updateVec);
        }
      }
    }
  };

  /**
   * loadTreeData(treeData)
   * 
   * Accepts a node tree (or array of root nodes) from your external system,
   * clears the internal node embeddings, and trains on each node recursively.
   * 
   * Note: This will reset the RHEmbed.NodeEmbeddings.nodes array and recalculate
   * the n‑gram distributions for each node. It does not clear the vocabulary,
   * so previously learned token embeddings will be reused.
   */
  RHEmbed.loadTreeData = function(treeData) {
    // Clear the existing node embeddings
    RHEmbed.NodeEmbeddings.nodes = [];
    
    // A recursive function that trains on a node and then recurses on its children.
    function traverseAndTrain(node) {
      if (!node) return;
      // Train on this node (this will compute token distributions and store the reference to the node)
      RHEmbed.Trainer.trainOnNode(node);
      // If the node has children, traverse them
      if (node.children && node.children.length > 0) {
        node.children.forEach(function(child) {
          traverseAndTrain(child);
        });
      }
    }
    
    // If treeData is an array of nodes, process each; otherwise, assume it's a single root node.
    if (Array.isArray(treeData)) {
      treeData.forEach(function(node) {
        traverseAndTrain(node);
      });
    } else {
      traverseAndTrain(treeData);
    }
    
    console.log("RHEmbed: Tree data loaded and trained on", RHEmbed.NodeEmbeddings.nodes.length, "nodes.");
  };
  

  window.RHEmbed = RHEmbed;
})(window);
