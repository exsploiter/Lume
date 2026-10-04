import type { ParsedFile } from '@/types';

export interface GoldenTestCase {
  id: string;
  name: string;
  category: string;
  expectedRuleId: string;
  positiveFile: ParsedFile; // Must trigger vulnerability
  negativeFile: ParsedFile; // Safe / sanitized - MUST NOT trigger vulnerability
}

export const GOLDEN_SUITE: GoldenTestCase[] = [
  {
    id: 'tc-sql-injection',
    name: 'SQL Injection via Tainted Flow vs Parameterized Query',
    category: 'Injection',
    expectedRuleId: 'sql-injection-ast',
    positiveFile: {
      path: 'src/controllers/userController.js',
      content: `
        const db = require('../db');
        function getUser(req, res) {
          const userId = req.query.id;
          const query = "SELECT * FROM users WHERE id = " + userId;
          db.query(query);
        }
      `,
    },
    negativeFile: {
      path: 'src/controllers/userControllerSafe.js',
      content: `
        const db = require('../db');
        function getUser(req, res) {
          const userId = parseInt(req.query.id, 10);
          db.query('SELECT * FROM users WHERE id = $1', [userId]);
        }
      `,
    },
  },
  {
    id: 'tc-command-injection',
    name: 'Command Injection via Exec vs Argument Array',
    category: 'Injection',
    expectedRuleId: 'command-injection-ast',
    positiveFile: {
      path: 'src/utils/system.js',
      content: `
        const { exec } = require('child_process');
        function pingHost(req, res) {
          const host = req.body.host;
          exec("ping -c 1 " + host);
        }
      `,
    },
    negativeFile: {
      path: 'src/utils/systemSafe.js',
      content: `
        const { execFile } = require('child_process');
        function pingHost(req, res) {
          const host = req.body.host;
          if (/^[a-zA-Z0-9.-]+$/.test(host)) {
            // Safe execFile with argument array
          }
        }
      `,
    },
  },
  {
    id: 'tc-ssrf',
    name: 'Server-Side Request Forgery (SSRF) vs Allowlist Destination',
    category: 'SSRF',
    expectedRuleId: 'ssrf-ast',
    positiveFile: {
      path: 'src/services/webhook.js',
      content: `
        async function triggerWebhook(req, res) {
          const targetUrl = req.query.url;
          const response = await fetch(targetUrl);
          return response.json();
        }
      `,
    },
    negativeFile: {
      path: 'src/services/webhookSafe.js',
      content: `
        const ALLOWED_HOSTS = ['api.internal.service.com'];
        async function triggerWebhook(req, res) {
          const parsed = new URL('https://api.internal.service.com/events');
          return fetch(parsed.toString());
        }
      `,
    },
  },
  {
    id: 'tc-path-traversal',
    name: 'Path Traversal via Tainted fs.readFile vs Base Directory Confinement',
    category: 'Path',
    expectedRuleId: 'path-traversal-ast',
    positiveFile: {
      path: 'src/routes/files.js',
      content: `
        const fs = require('fs');
        function getDocument(req, res) {
          const filename = req.params.filename;
          const fullPath = '/var/data/' + filename;
          return fs.readFileSync(fullPath, 'utf8');
        }
      `,
    },
    negativeFile: {
      path: 'src/routes/filesSafe.js',
      content: `
        const fs = require('fs');
        const path = require('path');
        function getDocument(req, res) {
          const safeName = path.basename(req.params.filename);
          const fullPath = path.resolve('/var/data', safeName);
          if (fullPath.startsWith('/var/data/')) {
            // Verified base containment
          }
        }
      `,
    },
  },
  {
    id: 'tc-xss',
    name: 'Cross-Site Scripting via innerHTML vs textContent',
    category: 'XSS',
    expectedRuleId: 'xss-ast',
    positiveFile: {
      path: 'src/public/renderer.js',
      content: `
        function renderComment(req) {
          const message = req.body.message;
          document.getElementById('chat').innerHTML = message;
        }
      `,
    },
    negativeFile: {
      path: 'src/public/rendererSafe.js',
      content: `
        function renderComment(req) {
          const message = req.body.message;
          document.getElementById('chat').textContent = message;
        }
      `,
    },
  },
  {
    id: 'tc-hardcoded-secret',
    name: 'High Entropy API Key vs Environment Variable Placeholder',
    category: 'Secrets',
    expectedRuleId: 'high-entropy-secret-ast',
    positiveFile: {
      path: 'src/config/auth.js',
      content: `
        // Exposed production AWS access credential
        const AWS_SECRET_KEY = "AKIAIOSFODNN7EXAMPLE";
        const GITHUB_PAT = "ghp_n0tAr3alT0k3nF0rT3st1ngPurp0s3s0nly123456";
      `,
    },
    negativeFile: {
      path: 'src/config/authSafe.js',
      content: `
        // Config reading properly from environment variables with placeholder fallback
        const apiKey = process.env.API_KEY || "YOUR_API_KEY_HERE";
        const clientSecret = process.env.CLIENT_SECRET || "TODO_CONFIGURE_SECRET";
      `,
    },
  },
  {
    id: 'tc-eval',
    name: 'Dynamic Code Evaluation (eval) vs Structured Parsing',
    category: 'Injection',
    expectedRuleId: 'eval-ast',
    positiveFile: {
      path: 'src/compiler/runner.js',
      content: `
        function runScript(req) {
          const script = req.body.script;
          return eval(script);
        }
      `,
    },
    negativeFile: {
      path: 'src/compiler/runnerSafe.js',
      content: `
        function parsePayload(req) {
          const data = JSON.parse(req.body.payload || '{}');
          return data;
        }
      `,
    },
  },
];
