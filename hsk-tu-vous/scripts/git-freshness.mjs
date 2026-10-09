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
  const localHeadSha = exec('rev-parse', '--verify', 'HEAD');
  // Refuse detached HEAD: no reliable way to verify latest remote branch edits.
  const currentBranch = exec('symbolic-ref', '--quiet', '--short', 'HEAD');
  if(!/^[a-z0-9][a-z0-9/_-]*$/i.test(currentBranch) || currentBranch.includes('..')) {
    throw new Error('Invalid or detached Git branch. Production requires a normal branch.');
  }
  // Inspect remote main and the source branch independently. Never pull/merge silently.
  exec('fetch', '--quiet', '--no-tags', 'origin', 'refs/heads/main');
  const remoteMainSha = exec('rev-parse', '--verify', 'FETCH_HEAD');
  let remoteBranchSha = remoteMainSha;
  if(currentBranch !== 'main'){
    exec('fetch', '--quiet', '--no-tags', 'origin', 'refs/heads/' + currentBranch);
    remoteBranchSha = exec('rev-parse', '--verify', 'FETCH_HEAD');
  }
  if (![localHeadSha, remoteMainSha, remoteBranchSha].every(x=>SHA.test(x))) throw new Error('Invalid Git SHA');
  for (const [refName, remoteSha] of [['main',remoteMainSha],[currentBranch,remoteBranchSha]]) {
    const result=run('git',['merge-base','--is-ancestor',remoteSha,localHeadSha],
      { cwd, encoding:'utf8', timeout:30000, windowsHide:true });
    if(result.error || result.status !== 0){
      throw new Error('Production blocked: local checkout is stale against remote ' + refName +
        ' (' + remoteSha.slice(0,12) + '). Update the checkout before generating media.');
    }
  }
  return {localHeadSha,remoteMainSha,remoteBranchSha,currentBranch,verifiedAt:new Date().toISOString(),
    branchSafety:'remote-main-and-current-branch-are-ancestors'};
}

export function requireFreshGitMain({ run = spawnSync, cwd = projectRoot } = {}) {
  return verifyFetchedMain({run,cwd});
}
