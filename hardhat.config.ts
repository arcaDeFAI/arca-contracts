import type { HardhatUserConfig } from "hardhat/config";
import { config as dotenvConfig } from "dotenv";
import * as path from "path";
import * as fs from "fs";
import fg from "fast-glob";

dotenvConfig();

const projectRoot = process.cwd();
const MERGED_SOURCES = path.join(projectRoot, ".hardhat-merged-sources");
const DEBUG_MERGED = !!process.env.DEBUG_MERGED_SOURCES;

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function resolveImport(fromFile: string, importPath: string): string | null {
  // Try several candidate locations; return first that exists AND is inside projectRoot
  const tryCandidates = (cands: string[]) => {
    for (const c of cands) {
      try {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) {
          const abs = path.resolve(c);
          const relToRoot = path.relative(projectRoot, abs);
          if (relToRoot.startsWith("..")) {
            // it's outside the project root — we *don't* include those
            return null;
          }
          return abs;
        }
      } catch {
        /* ignore */
      }
    }
    return null;
  };

  const dirname = path.dirname(fromFile);
  const candidates: string[] = [];

  // direct resolves relative to the importing file
  candidates.push(path.resolve(dirname, importPath));
  if (!importPath.endsWith(".sol")) candidates.push(path.resolve(dirname, importPath + ".sol"));

  // try project-root based resolution (some imports are given relative to root)
  candidates.push(path.resolve(projectRoot, importPath));
  if (!importPath.endsWith(".sol")) candidates.push(path.resolve(projectRoot, importPath + ".sol"));

  // try node_modules fallback (rare for local imports, but harmless)
  candidates.push(path.resolve(projectRoot, "node_modules", importPath));
  if (!importPath.endsWith(".sol")) candidates.push(path.resolve(projectRoot, "node_modules", importPath + ".sol"));

  // Absolute path attempt
  if (path.isAbsolute(importPath)) {
    candidates.unshift(importPath);
    if (!importPath.endsWith(".sol")) candidates.unshift(importPath + ".sol");
  }

  return tryCandidates(candidates);
}

function buildMergedSources(): string {
  // wipe old merged folder
  try { fs.rmSync(MERGED_SOURCES, { recursive: true, force: true }); } catch { /* ignore */ }
  ensureDir(MERGED_SOURCES);

  // --- === ENTRY POINT PATTERNS (keep these narrow to avoid pulling everything) === ---
  // Customize these if you want different entry files; these match your v2 behaviour
  const patterns = [
    "contracts/**/*.sol",                           // default project contracts
    "contracts-metropolis/src/**/*.sol",            // metropolis sources
    "contracts-shadow/src/*.sol",                   // shadow entry files (top-level src files)
    "contracts-shadow/src/interfaces/*.sol",        // the interfaces that your src files import
    "test/mocks/**/*.sol",                          // test mocks
  ];

  // initial set of files
  const initialFiles = fg.sync(patterns, { cwd: projectRoot, absolute: true });

  if (DEBUG_MERGED) console.log("[buildMergedSources] initialFiles:", initialFiles.map(f => path.relative(projectRoot,f)));

  // BFS / closure over imports
  const queue: string[] = [...initialFiles];
  const seen = new Set<string>(initialFiles.map(p => path.resolve(p)));
  const unresolved: { from: string; imp: string }[] = [];

  const importRegex = /import\s+(?:[^'"]+\s+from\s+)?["']([^"']+)["']/g;

  while (queue.length) {
    const file = queue.shift()!;
    let src: string;
    try {
      src = fs.readFileSync(file, "utf8");
    } catch (e) {
      // unexpected but surface a clear message
      throw new Error(`Failed to read file while building merged sources: ${file}\n${(e as Error).message}`);
    }

    let m: RegExpExecArray | null;
    importRegex.lastIndex = 0;
    while ((m = importRegex.exec(src)) !== null) {
      const imp = m[1];

      // Resolve the import to a project-local file if possible
      const resolved = resolveImport(file, imp);

      if (!resolved) {
        // If it's a relative import (starts with '.' or '/'), that's likely a missing file inside the project.
        // Collect so we produce a helpful error (instead of encountering HHE902 later).
        if (imp.startsWith(".") || imp.startsWith("/")) {
          unresolved.push({ from: file, imp });
        } else {
          // non-relative import (e.g. `@openzeppelin/...`) - we skip it here since it's an npm dep
          if (DEBUG_MERGED) {
            console.log(`[buildMergedSources] skipping non-local import from ${path.relative(projectRoot, file)} -> ${imp}`);
          }
        }
        continue;
      }

      const absRes = path.resolve(resolved);
      if (!seen.has(absRes)) {
        seen.add(absRes);
        queue.push(absRes);
        if (DEBUG_MERGED) console.log(`[buildMergedSources] added: ${path.relative(projectRoot, absRes)}`);
      }
    }
  }

  // If there are unresolved relative imports, fail early with a friendly message
  if (unresolved.length) {
    const sample = unresolved.slice(0, 8).map(u => `${path.relative(projectRoot, u.from)} -> ${u.imp}`).join("\n");
    throw new Error(
      `Missing relative imports detected while building merged sources (these imports were referenced but the target files weren't found in the project):\n\n${sample}\n\n` +
      `If those files exist elsewhere in the repo, add the matching glob to the 'patterns' above (e.g. "contracts-shadow/CL/**/*.sol"), ` +
      `or place them under the project root.`
    );
  }

  // Write out symlinks/copies preserving the original relative layout
  for (const absolute of Array.from(seen)) {
    const rel = path.relative(projectRoot, absolute);
    const dest = path.join(MERGED_SOURCES, rel);
    ensureDir(path.dirname(dest));
    try {
      // prefer symlink for live-edit friendliness
      if (!fs.existsSync(dest)) fs.symlinkSync(absolute, dest);
    } catch {
      // fallback to copying
      fs.copyFileSync(absolute, dest);
    }
  }

  if (DEBUG_MERGED) {
    console.log(`[buildMergedSources] merged ${seen.size} files into ${path.relative(projectRoot, MERGED_SOURCES)}`);
  }

  return MERGED_SOURCES;
}


const sourcesDir = buildMergedSources();


const config: HardhatUserConfig = {
  plugins: [
  ],
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            details: {
              yulDetails: {
                optimizerSteps: "u",
              },
            },
          },
        }
      },
      {
        version: "0.8.26",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
        }
      }
    ]
  },
  paths: {
    sources: sourcesDir,
  },
  networks: {
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: false,
      type: 'edr-simulated'
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      // Use default hardhat accounts for localhost
      accounts: "remote",
      type: 'edr-simulated'
    },
    "sonic-mainnet": {
      url: process.env.SONIC_MAINNET_RPC_URL || "https://rpc.soniclabs.com",
      chainId: 146,
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 64) ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto",
      timeout: 120000,
      type: 'http'
    },
    "sonic-fork": {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      forking: {
        url: process.env.SONIC_MAINNET_RPC_URL || "https://rpc.soniclabs.com",
        // Use a specific recent block instead of latest to avoid hardfork issues
        blockNumber: 36000000,
      },
      accounts: "remote",
      timeout: 120000,
      // Override hardfork to handle Sonic's custom chain
      hardfork: "cancun",
      type: 'http'
    },
    "sonic-mainnet-alchemy": {
      url: process.env.ALCHEMY_API_KEY 
        ? `https://sonic-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : "https://rpc.soniclabs.com",
      chainId: 146,
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 64) ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto",
      timeout: 120000,
      type: 'http'
    },
    "sonic-testnet": {
      url: process.env.SONIC_TESTNET_RPC_URL 
        ? process.env.SONIC_TESTNET_RPC_URL
        : "https://rpc.blaze.soniclabs.com",
      chainId: 57054,
      accounts: (process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.length === 64) ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto",
      timeout: 120000,
      type: 'http'
    },
  },
  etherscan: {
    // Sonic requires network-specific API keys
    apiKey: {
      "sonic-mainnet": process.env.SONIC_SCAN_API_KEY || "placeholder",
      "sonic-testnet": process.env.SONIC_TESTNET_SCAN_API_KEY || "placeholder",
    },
    customChains: [
      {
        network: "sonic-mainnet",
        chainId: 146,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://sonicscan.org"
        }
      },
      {
        network: "sonic-testnet",
        chainId: 57054,
        urls: {
          apiURL: "https://api-testnet.sonicscan.org/api",
          browserURL: "https://testnet.sonicscan.org",
        },
      },
    ],
  },
};

export default config;
