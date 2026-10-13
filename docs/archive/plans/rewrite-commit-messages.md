# Rewrite Every Commit Message Plan

> **Status (2026-10-13):** shelved by the owner after step 4. Tracked in `open-items.md` → Deferred,
> "Older commit messages carry Claude trailers and session links". See "Why it was shelved" at the
> end. The plan was final (pass 12 found nothing) and rulings R1–R8 are recorded.

## Why it was shelved

Steps 0–4 ran: `4f4603e` committed the rules and this plan, and all 283 drafts passed the step-3
checks and the owner's review. Before step 5, a check of GitHub's pull request refs showed that the
rewrite can't do what it's for:

- GitHub keeps `refs/pull/N/head` for every pull request, and repo owners can't delete it. Each one
  keeps its branch's ancestors fetchable, with their original messages.
- `refs/pull/11/head` alone keeps 244 of the 284 old `main` commits reachable, including all 13 with
  a `Claude-Session:` link. They also stay viewable at `/commit/<old hash>`.
- Only GitHub Support can remove them, by deleting the pull requests and running garbage collection.

The owner chose to protect new commits instead: the `CLAUDE.md` rules, plus `attribution` set to
`{"commit": "", "pr": "", "sessionUrl": false}` in the user settings. `sessionUrl: false` is the
setting that stops the `Claude-Session:` trailer.

The drafts and scripts are in that session's scratchpad, not in the repo, so reopening means
drafting the messages again.

**Goal:** every commit message loses its Claude trailers and gets shorter: a one-line summary, then a
body of 1–2 lines, or none if the summary says it all. A squashed commit gets one line for each topic,
with a blank line between topics. Each tag ends up on the rewritten copy of the commit it marks today.
The force-push doesn't start CI or release builds.

**Spec:** the owner, 2026-10-13: "remove all claude trailers in the commit messages and make them more
concise main/first line for a concise summary then just a few lines after. ideally 1-2 lines but if it is
a squashed commit, 1 line per "topic" is fine, separated by a space each"; then "if the commit can be
described in just the first line then no detail lines are needed". Earlier: "without triggering all the
builds/actions again but still keep the tags in the proper commits".

## Current state (main at 4edf8ac)

- 286 commits across all refs:
  - 284 on `main`, with 1 merge (`b541048`, a Dependabot pull request).
  - 2 only reachable from tag `v1.4.6` (`03e8c27`, `2ecd19b Release 1.4.6`). That release was tagged on
    a line that left `main` at `64bebe6`. filter-repo rewrites every ref, so these 2 get new messages
    too.
- 50 tags locally:
  - 44 lightweight, which point straight at a commit.
  - 6 annotated (`v0.1.0`, `v1.0.0`, `v1.0.1`, `v1.0.2`, `v1.1.0`, `v1.1.1`), none of them signed.
  - The 49 `v*` tags are on GitHub, one Release each; none is a draft or a prerelease.
  - `backup-test` (lightweight, at `eca80da`) exists only on this PC. It mustn't be pushed (step 6).
- Claude trailers:
  - 283 `Co-Authored-By: Claude …` lines in 279 commits; 4 commits have two. By model: Opus 5.5: 127,
    Opus 5: 98, Fable 5.1: 49, Fable 5: 8, Sonnet 5: 1.
  - 13 `Claude-Session: https://claude.ai/code/session_…` lines.
  - 3 `Signed-off-by: dependabot[bot]` lines too. These aren't Claude's.
- How long the bodies are, not counting trailers (286 commits, all refs):
  - No body: 93 commits.
  - 1–3 lines: 56.
  - 4–10 lines: 99.
  - 11–35 lines: 38. These are mostly squashes and release commits.
- Summary lines run 13–159 characters; the median is 51.
- 3 commits are signed by GitHub (`cd315c4`, a docs commit made in the web UI; `b541048`; `9c73aa7`, from
  Dependabot). Rewriting them loses their "Verified" badge. git and filter-repo drop the signatures on
  their own, so this doesn't stop the run.
- No notes refs, replace refs, stash, extra worktrees, non-UTF-8 messages, empty messages or CR bytes in
  any message.
- Summary lines matter in two places:
  - **Release notes:** `release.yml:545` builds them from `git log --format='%s' --no-merges`, dropping
    summaries that match `^(Release [0-9]|ci:|docs:|release:|chore:)`. Those prefixes have to stay, or a
    rebuilt note would include housekeeping.
  - **Release title:** it's taken from the newest summary. Notes already published sit on GitHub, so a
    rewrite doesn't change them; step 6b updates the notes and leaves the titles alone (R5).
- Workflows a push can start:
  - `ci.yml`: a push to `main`, except when only `docs/**` and `**/*.md` change. The new tip differs from
    the old one only in those files, so it may not run at all.
  - `release.yml`: a push of a `v*` tag. GitHub's docs say no event is created when more than three tags
    are pushed at once (not tested here), so 49 tags likely start nothing. The workflows are turned off
    anyway, as a second safeguard.
  - The Dependabot updates workflow isn't ours to turn off, and may show a run of its own.
- GitHub protection, checked with `gh api`:
  - Ruleset "Protect release tags" on `refs/tags/v*` blocks deleting or updating a tag. Admins can always
    bypass it, and `current_user_can_bypass` is `always`.
  - `main` has a non-fast-forward rule with the same admin bypass.
  - Immutable releases are off. There are no open pull requests, webhooks, Pages site or forks.
  - Pull request refs `refs/pull/2..11/head` stay on GitHub and keep some old commits reachable.
- Clones: this PC, the Windows VM (md-viewer-win-vm), the Linux VM and the Mac.
- `git-filter-repo` 2.47.0 is installed as a Python module (Python 3.14.7). It runs as
  `python -m git_filter_repo`, or it can be imported from a script (step 5).

## Rules for a new message

The rules for future commits are in `CLAUDE.md` → "Commit messages", added at the owner's request on
2026-10-13; that edit isn't committed yet. The rewrite uses the same rules, plus 5 and 6:

1. The summary line is a plain sentence with no trailing full stop. Aim for ≤72 characters and never
   go over 100 (R3).
   - Without a prefix, it's a release-note line: say what changed for someone using the app, not
     which code changed.
   - With a prefix, just say what changed (R4).
2. Keep any `docs:`, `ci:`, `chore:` or `release:` prefix and every `Release X.Y.Z` summary exactly as
   it is, so the release-notes filter still works.
3. The body:
   - None, if the summary says it all.
   - Otherwise 1–2 lines.
   - A squash gets one line per topic, with a blank line between topics.
   - Lines wrap at 72.
4. Remove every Claude trailer (`Co-Authored-By: Claude …` and `Claude-Session: …`) and any other AI
   attribution line (R6). Keep any other trailer.
5. Don't touch these at all:
   - the merge commit
   - the Dependabot commits
   - the 6 annotated tags' own messages
6. Don't invent facts. The new message only shortens the old one; the writer doesn't look at the diff.
   Leave any commit hash inside an old message as it is; step 5 translates it.

## Steps

From step 1 until step 7, don't commit to this PC's repo. The rewrite works from a frozen copy, and
step 7 resets this repo to the result.

0. **Commit first.** Commit the `CLAUDE.md` rules and this plan locally, as one `docs:` commit that
   follows the new rules. Its message comes through the rewrite unchanged; its hash still changes,
   because its parent does.
1. **Freeze a copy.** Make a mirror clone of this repo in the scratchpad (`git clone --mirror`). Every
   later step reads the old history from this mirror, and it stays until every clone has been reset.
   → check: `git -C <mirror> rev-parse main` = this repo's `main` (step 0's commit), the mirror has 50
   tags, and `git -C <mirror> rev-list --all --count` = 287.
2. **Export.** A script reads the mirror and writes `messages.json` to the scratchpad. There's one entry
   for each commit reachable from any ref (287): the full hash, the old message, and whether the commit
   is a merge or from Dependabot. The message comes from the raw `git cat-file commit` bytes, not
   `%B`, which changes trailing newlines. Four untouched messages have no final newline: the merge and
   the 3 Dependabot commits.
   - It also builds the old release notes and compares them with GitHub (step 6b, "Old list"). The
     review already did this once: 37 of 49 pages match. 12 don't, because they were edited by hand
     (v0.1.0, v1.0.2, v1.1.0, v1.3.0, v1.4.4, v1.4.7, v1.5.0, v1.5.1, v1.5.8, v1.6.0, v1.6.3,
     v1.7.3). Step 2 checks the counts again.
3. **Rewrite.** 4 `scribe` agents (Sonnet) run in parallel, about 70 commits each. Each gets the rules
   above and writes `{hash: new message}` for its share.
   - A script then merges them into `new-messages.json` and checks every rule it can check:
     - 283 messages: 287 commits minus the 4 untouched ones. Step 0's commit is one of the 283, with
       its message copied as it is, since it already follows the rules
     - every prefix is kept
     - the release-notes regex (`^(Release [0-9]|ci:|docs:|release:|chore:)`, case-sensitive) matches
       the same commits before and after, so no commit moves in or out of the notes
     - every summary is ≤100 characters
     - no body line is over 72 characters
     - no rewritten message contains `\r`, and each ends with exactly one `\n`. Untouched messages
       are excluded, because 4 of them have no final newline
     - no line matching `^(Co-Authored-By: Claude|Claude-Session:)` is left (ignoring case)
     - `new-messages.json` holds every commit except the 4 untouched ones (the merge and the 3
       Dependabot commits)
     - every line that mentions `Claude`, `anthropic` or `claude.ai` goes to the owner. Expect hits
       for legitimate mentions of `CLAUDE.md`: one existing commit, plus step 0's.
4. **Owner review.** The owner reads `review.md` in the scratchpad: old and new message side by side, in
   history order, with squashes and release commits flagged. Their edits go back into
   `new-messages.json`, and the step-3 checks run again.
5. **Apply in a fresh clone of the mirror:** `git clone --no-local <mirror> <work>`. The review
   checked a `--no-local` clone by hand against the conditions filter-repo's freshness check tests
   (source L3394–3515), and all held. It also confirmed the clone brings all 50 tags. filter-repo's
   own check hasn't run yet.
   - `apply.py` imports `git_filter_repo` and runs it from the work clone's top directory:
     - `args = fr.FilteringOptions.default_options()`. `parse_args([])` exits with "No arguments
       specified". Don't add `--force`, which skips the freshness check, or `--refs`, which means no
       gc and no removal of `origin`.
     - `fr.RepoFilter(args, commit_callback=cb).run()`.
     - `cb(commit, metadata)` changes only commits in `new-messages.json`, looked up by
       `commit.original_id`. It sets the new message (UTF-8 bytes) and translates the old hashes in
       it with `re.sub(rb'(\b[0-9a-f]{7,40}\b)', metadata['commit_rename_func'], msg)`. The capture group
       is needed, because filter-repo's translate function reads group 1. Other commits keep the
       message filter-repo already has, with its hashes already translated.
     - Not run in review: the permission system blocked a trial. Step 5's checks are its test, and
       nothing leaves the throwaway clone before step 6.
     - Only one old message names a commit in this repo (`15a4a2a` names `9e5d907`, an ancestor). A
       hash naming a later commit couldn't be translated, but none exists.
   - Why not `git filter-repo --commit-callback`: filter-repo rewrites hashes in a message *before*
     the commit callback runs (`_tweak_commit`: L3950 rewrites, L4108 calls back). A message replaced
     in that callback would keep every old hash, and the CLI version doesn't expose the rename
     function (L3224–3227). `--message-callback` doesn't get the commit, and 2 old messages are exact
     duplicates, so it can't be keyed by message.
   - filter-repo removes `origin` once it's done. Add it back with
     `git remote add origin git@github.com:toperux/t4-markdown-viewer.git`.
   - filter-repo gc's the old commits away, so every check reads the old side from the mirror:
     - before filter-repo runs, the clone has all 50 tags and 287 commits (`git rev-list --all`)
     - same commit count afterwards
     - pair each old commit with its new one through `.git/filter-repo/commit-map`, not by position
       (the merge makes position unreliable). Check each pair has the same tree hash (old from
       `git -C <mirror> rev-parse <old>^{tree}`), so no file content changed. Check the authors,
       committers and both dates are equal too
     - every tag's new commit has the same tree as its old commit in the mirror
     - every hash in a new message that named a commit in the old history now names one in the new
       history. Hex strings that never were commits are skipped, such as theme colours like `0d1117`
     - `git log --all --format=%B | grep -ciE '^(co-authored-by: claude|claude-session:)'` = 0
   - Expected noise: Dependabot messages mention 40-character hashes from upstream projects.
     filter-repo lists those in `.git/filter-repo/suboptimal-issues` as referenced but missing.
     That's harmless.
5b. **Map commit** (R2). In the fresh clone, turn `.git/filter-repo/commit-map` into
    `docs/notes/commit-map.txt`: a short header line, then one `<old> <new>` pair per line, with the
    filter-repo header row dropped. Commit it as
    `docs: map old commit hashes to their rewritten ones`.
    → check: one pair for every commit (287), and every new hash in it resolves.
6. **Push from the fresh clone, only on the owner's go:**
   ```
   R=toperux/t4-markdown-viewer
   gh workflow disable ci.yml -R $R
   gh workflow disable release.yml -R $R
   git push --force --atomic origin main 'refs/tags/v*'
   # wait about 5 minutes, then check `gh run list -R $R` shows no run for ci.yml or release.yml
   gh workflow enable ci.yml -R $R
   gh workflow enable release.yml -R $R
   ```
   - `--atomic` means GitHub takes all the refs or none of them, so a refused tag can't leave `main`
     rewritten while the tags still point at old commits. The review tested the command against a
     local bare repo.
   - `refs/tags/v*` pushes the 49 release tags and leaves out `backup-test`.
   - The wait is because GitHub handles push events after the push returns. Turning the workflows back
     on straight away might let a late event start a run (reasoned, not measured).
   - Turn the workflows back on even if the push fails.
   - Checks:
     - `git ls-remote origin refs/heads/main 'refs/tags/v*'` matches `git show-ref -d` for the local
       `main` and `v*` tags, `^{}` lines for the 6 annotated tags included. Only those refs, because
       GitHub also keeps `refs/pull/*` refs, and `backup-test` isn't pushed
     - each GitHub Release still shows its tag and assets
6b. **Rebuild the release notes** (R5). There are 49 GitHub Releases. Each one's notes are the
    `notes.md` that `release.yml` ("Build the release notes", lines 537–554) built when its tag was
    pushed, published unchanged (`body_path: notes.md`).
    - A script rebuilds that file for each release tag `T`, exactly as the workflow does:
      - the previous tag is `git describe --tags --abbrev=0 --match 'v*' T^`. If there's none
        (`v0.1.0`), the range is all history up to `T`, as the workflow's `${prev:+$prev..}` does.
        `v1.4.6` is off `main`, so `v1.4.7`'s previous tag is `v1.4.5`; old and new histories agree on
        this
      - `git log --format='%s' --no-merges <range>`, minus lines matching the release-notes regex,
        each line prefixed with `- `, ending in a newline
      - if nothing is left, the file is `No user-facing changes.`
    - It runs twice:
      - **Old list:** on the mirror. It's compared with the page's notes now
        (`gh release view T --json body`), ignoring blank lines at the end. This runs in step 2.
      - **New list:** on the rewritten history.
    - Matching pages are safe to replace. The 12 that don't match keep their notes and old summaries;
      the owner decides on each of them (R5).
    - The owner reviews `release-notes-review.md` before anything changes: each release that will be
      replaced, with its old and new notes, plus the list of releases that won't be.
    - **Only on the owner's go:** `gh release edit T --notes-file <new>` for each matching release.
      Titles aren't touched. Editing a release starts no workflow: `ci.yml` and `release.yml` have
      no `release:` trigger.
    → check: each edited page's notes equal its new list; every other page is unchanged.
7. **Reset this PC's repo and the other clones:** `git fetch --force --tags`, then
   `git reset --hard origin/main` on each. Any work in those clones that hasn't been pushed has to be
   moved over first, so check before resetting. On this PC, `backup-test` isn't on GitHub, so a fetch
   doesn't move it, and it keeps pointing at the old commit `eca80da`. Its rewritten copy is in the
   fresh clone, but this PC's repo only gets that if the tag is copied over by hand.

## Risks

- **Old hashes in the docs.** About 250 mentions, mostly in `closed-items.md` and `docs/archive/`. Once
  rewritten, they're no longer in the history; the map from R2 keeps them traceable. GitHub may keep
  some old commits viewable through the pull request refs and its own caches. Don't count on that.
- **Tag protection.** The ruleset blocks updating `v*` tags, but admins bypass it, and the GitHub API
  says this account can. Not yet tested on the real remote. If the push is refused, `--atomic` leaves
  the remote as it was: turn the workflows back on and look at the rules.
- **Signed commits.** 3 GitHub-signed commits lose their "Verified" badge. No tag is signed.
- **Repo moving underneath.** Covered by the frozen mirror and by not committing between step 1 and
  step 7.

## Owner rulings (2026-10-13)

- **R1. Who drafts:** Sonnet `scribe` agents draft every message, and the owner reviews every one in
  step 4.
- **R2. Old hashes in the docs:** commit an old→new map as `docs/notes/commit-map.txt`; see step 5b.
  Files already in history stay as they are.
- **R3. Summary length:** aim for 72 characters and never go over 100.
- **R4. Summary voice:** write a summary without a prefix for someone using the app, because it becomes
  a release-note line; a summary with a prefix just says what changed. The same rule goes into
  `CLAUDE.md`.
- **R5. Release pages:** rebuild the notes on each GitHub Release from the new summaries and leave the
  titles alone, because some were picked by hand. Only replace pages whose current notes match what
  the old history builds; the owner decides on the rest (step 6b).
- **R6. `CLAUDE.md` wording:** a squashed commit's topics are separated by a blank line. The rule bans
  any AI attribution line, not just the Claude trailer.
- **R7. Dependabot commits:** leave the merge and the 3 Dependabot commits as they are (rule 5),
  including `9c73aa7`, whose summary has no prefix and so stays in the release notes.
- **R8. Step 4 review:** the "Review 2026-09-20: #N" lines stay dropped from `0cbadf1`, `ae50077` and
  `a7fc23e`. `f72d4ac` and `c4897ce` gain `docs:` and `64bebe6` gains `chore:`, leaving the release
  notes. `7060f25`, `3bbcf71` and `cfd1e00` were reworded as recommended.
