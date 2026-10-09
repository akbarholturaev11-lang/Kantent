import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA = /^[0-9a-f]{40}$/i;

export function verifyFetchedMain({ run, cwd = projectRoot }) {
  const exec = (...args) => {
    const r = run('git', args, { cwd, encoding: 'utf8', timeout: 30000, windowsHide: true });
    if (r.error || r.status !== 0) {
      throw new Error('GitHub freshness check blocked: git ' + args.join(' ') +
        ' failed. ' + String(r.stderr || r.error?.message || 'unknown git error').slice(0, 260));
    }
    return String(r.stdout || '').trim();
  };
  // Fetch current remote main without overwriting or merging local working files.
  exec('fetch', '--quiet', '--no-tags', 'origin', 'refs/heads/main');
  const remoteMainSha = exec('rev-parse', '--verify', 'FETCH_HEAD');
  const localHeadSha = exec('rev-parse', '--verify', 'HEAD');
  if (!SHA.test(remoteMainSha) || !SHA.test(localHeadSha)) throw new Error('Invalid Git commit SHA from freshness check');
  const check = run('git', ['merge-base', '--is-ancestor', remoteMainSha, localHeadSha],
    { cwd, encoding: 'utf8', timeout: 30000, windowsHide: true });
  if (check.error || check.status !== 0) {
    throw new Error('Production blocked: local checkout is stale against GitHub main (' +
      remoteMainSha.slice(0, 12) + '). Merge/rebase the current main into this branch before generating media.');
  }
  return { localHeadSha, remoteMainSha, verifiedAt: new Date().toISOString(), branchSafety: 'remote-main-is-ancestor' };
}

export function requireFreshGitMain({ run = spawnSync, cwd = projectRoot } = {}) {
  return verifyFetchedMain({run, cwd});
}
