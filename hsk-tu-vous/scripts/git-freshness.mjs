import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA = /^[0-9a-f]{40}$/i;

const MAX_LISTED_DIRTY_PATHS = 100;

/**
 * X-14: HEAD alone does not describe media rendered from uncommitted tracked
 * or untracked (non-ignored) project files. Disclose them with a content
 * hash instead of blocking: the pipeline itself legitimately updates tracked
 * ledgers such as cta-lab.json during a local run. Files are hashed directly
 * (no `git diff` output), so a large binary change cannot overflow a buffer.
 */
export function describeSourceTree({ run, cwd = projectRoot, readFile = fs.readFileSync }) {
  const git = (args) => {
    const r = run('git', args, { cwd, encoding: 'utf8', timeout: 30000, windowsHide: true });
    if (r.error || r.status !== 0)
      throw new Error('GitHub freshness check blocked: git ' + args.join(' ') + ' failed. ' +
        String(r.stderr || r.error?.message || 'unknown git error').slice(0, 260));
    return String(r.stdout || '');
  };
  const entries = git(['status', '--porcelain=v1', '-z', '--untracked-files=normal', '--', '.'])
    .split('\0').filter(Boolean);
  const dirtyPaths = [];
  for (let index = 0; index < entries.length; index += 1) {
    const code = entries[index].slice(0, 2);
    dirtyPaths.push(entries[index].slice(3));
    if (code[0] === 'R' || code[0] === 'C') index += 1; // skip the rename source
  }
  dirtyPaths.sort();
  if (!dirtyPaths.length) return { sourceTreeClean: true };
  const repoRoot = git(['rev-parse', '--show-toplevel']).trim();
  const digest = createHash('sha256');
  for (const relative of dirtyPaths) {
    let fileHash = 'deleted';
    try {
      fileHash = createHash('sha256').update(readFile(path.join(repoRoot, relative))).digest('hex');
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'EISDIR') throw error;
      if (error.code === 'EISDIR') fileHash = 'directory';
    }
    digest.update(relative + '\0' + fileHash + '\n');
  }
  return {
    sourceTreeClean: false,
    dirtyPathCount: dirtyPaths.length,
    dirtyPaths: dirtyPaths.slice(0, MAX_LISTED_DIRTY_PATHS),
    dirtySourceSha256: digest.digest('hex'),
  };
}

export function verifyFetchedMain({ run, cwd = projectRoot, readFile = fs.readFileSync }) {
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
  const sourceTree = describeSourceTree({ run, cwd, readFile });
  if (!sourceTree.sourceTreeClean)
    console.warn('SOURCE_TREE_DIRTY ' + JSON.stringify({ count: sourceTree.dirtyPathCount,
      paths: sourceTree.dirtyPaths.slice(0, 10), sha256: sourceTree.dirtySourceSha256 }) +
      ' — media from this run is NOT reproducible from ' + localHeadSha.slice(0, 12) + ' alone.');
  return {localHeadSha,remoteMainSha,remoteBranchSha,currentBranch,verifiedAt:new Date().toISOString(),
    branchSafety:'remote-main-and-current-branch-are-ancestors', ...sourceTree};
}

export function requireFreshGitMain({ run = spawnSync, cwd = projectRoot, readFile = fs.readFileSync } = {}) {
  return verifyFetchedMain({run,cwd,readFile});
}
