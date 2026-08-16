# Command Guide — npm & git (BIPJ-NETS)

Quick reference for the commands we actually use on this repo. Every npm script listed here
is real — taken from the root `package.json` and `backend/package.json`.

**Repo:** `https://github.com/CalvinCode115/BIPJ-NETS.git`
**Stack:** Ionic 8 + Angular 20 (frontend, port `8100`) + Express/Firebase (backend, port `3000`)

---

## PART 1 — npm

### 1.1 The one you'll use most

```bash
npm start
```

Runs **backend + frontend together** via `concurrently` — backend on `:3000`, Angular dev
server on `:8100` with the proxy config applied. This is the normal "I want to work on the app"
command. Press `Ctrl+C` once to kill both (the `-k` flag makes it tear down together).

=> back end:.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000

### 1.2 Running things separately

Useful when one half is misbehaving and you want cleaner logs.

| Command | What it does |
|---|---|
| `npm run start:app` | Angular dev server only (`:8100`), **no proxy** — API calls will fail |
| `npm run start:proxy` | Angular dev server only, **with** `proxy.conf.json` |
| `npm run backend` | Backend only — delegates to `npm --prefix backend start` |
| `npm run ionic:serve` | Same as `start:app` |

> **Proxy gotcha:** `start:app` has no proxy, so anything hitting `/api/...` returns 404.
> If the UI loads but every request fails, you probably ran `start:app` instead of `start:proxy`.

### 1.3 Building

| Command | What it does |
|---|---|
| `npm run build` | Development build |
| `npm run build:prod` | Production build (`--configuration production`) |
| `npm run watch` | Rebuilds on file change, development config |

### 1.4 Testing & linting

| Command | What it does |
|---|---|
| `npm test` | Runs Karma + Jasmine (`ng test`) — 15 spec files currently |
| `npm run lint` | `ng lint` |

> **`src/test.ts` must exist.** `angular.json` points the karma builder at it
> (`"main": "src/test.ts"`). If that file goes missing, `npm test` breaks entirely.
> Recovery is in §2.6 below.

### 1.5 Backend & database

Run from **project root**:

```bash
npm run backend            # start the API server
```

Run from **`backend/`** (or prefix with `npm --prefix backend`):

| Command | What it does |
|---|---|
| `npm run db:seed` | Seed Firestore — **merge** into existing data |
| `npm run db:seed:reset` | Seed Firestore — **full reset**, destroys existing data ⚠️ |
| `npm run db:migrate` | Run migration script |
| `npm run db:migrate-card-balance` | One-off: remove card balance field |
| `npm start` / `npm run dev` | Start `server.js` directly |

Example:

```bash
cd backend
npm run db:seed
```

> ⚠️ `db:seed:reset` wipes seeded collections. Use plain `db:seed` unless you genuinely want
> a clean slate.

Demo logins after seeding (PIN `123456`): Alex `91234567`, Sarah `87654321`,
Cheng `80680505`, Adam `84688331`.

### 1.6 Assets & Firebase deploy

| Command | What it does |
|---|---|
| `npm run generate:assets` | Runs `scripts/generate-home-pay-assets.mjs` |
| `npm run generate:demo-assets` | Same script (alias) |
| `npm run firebase:login` | `firebase login` |
| `npm run firebase:deploy:indexes` | Deploy Firestore indexes only |
| `npm run firebase:deploy:rules` | Deploy Firestore rules only |
| `npm run firebase:deploy:storage` | Deploy storage rules only |
| `npm run firebase:deploy:hosting` | **Prod build**, then deploy hosting |
| `npm run firebase:deploy` | **Prod build**, then deploy everything ⚠️ |

### 1.7 Dependency management

```bash
npm install                    # install root deps from package-lock.json
npm --prefix backend install   # install backend deps
npm ci                         # clean install, exact lockfile versions
```

**When to run `npm install`:** after pulling a commit that changed `package.json` or
`package-lock.json`. Check with `git diff HEAD@{1} --name-only | grep package`.

**The "nuke it" fix** when the build behaves impossibly:

```bash
rm -rf node_modules package-lock.json
npm install
```

Only do this if you're prepared to commit the regenerated lockfile — it can produce a huge diff
and conflict with teammates.

---
## ==========================================================================================================================
## ==========================================================================================================================
## ==========================================================================================================================

## PART 2 — git

### 2.1 Our branch layout

| Branch | Owner / purpose |
|---|---|
| `main` | Baseline. Currently well behind the working branches. |
| `Eron` | Eron's work — travel, FX, currency exchange |
| `calvin-phase2` | Calvin — phase 2 |
| `calvin-payogotchi` | Calvin — Payogotchi gamification |

### 2.2 ⚠️ The tracking gotcha (read this one)

`calvin-phase2` currently tracks **`origin/Eron`**, not `origin/calvin-phase2`. Check any
branch's upstream with:

```bash
git branch -vv
```

Output looks like `* calvin-phase2  deab86d [origin/Eron] ...` — the part in brackets is what
`git pull` and `git push` talk to by default.

**Why it matters:** on that branch a bare `git push` pushes **your** commits onto **Eron's**
branch. To repoint it at your own remote branch:

```bash
git push -u origin calvin-phase2
```

To just check before pushing:

```bash
git rev-parse --abbrev-ref @{u}    # prints the current upstream
```

### 2.3 Checking state before you do anything

```bash
git status              # what's changed in your working tree
git status --porcelain  # same, compact — good for a quick scan
git branch -vv          # branches + upstreams + ahead/behind
git log --oneline -10   # recent history
```

Status prefixes: ` M` = modified, ` D` = deleted, `??` = untracked, `A ` = staged-new.
A space in the first column means **unstaged**; a letter there means **staged**.

### 2.4 Pulling teammates' work safely

The safe sequence — look before you leap:

```bash
git fetch origin                              # download, change nothing locally
git log --oneline HEAD..origin/Eron           # what commits are incoming
git diff --stat HEAD..origin/Eron             # what files they touch
git pull                                      # actually apply it
```

**Can I pull with uncommitted changes?** Yes — *if* the incoming commits don't touch the same
files you've modified. Git aborts the pull rather than clobbering you. To check for overlap
ahead of time, compare the incoming file list against your dirty files.

**Is it a clean fast-forward?**

```bash
git merge-base --is-ancestor HEAD origin/Eron && echo "fast-forward" || echo "divergent"
```

Fast-forward = your branch just moves up, no merge commit, no conflicts.

**Pull from a specific branch regardless of tracking:**

```bash
git pull origin Eron
```

### 2.5 Stashing (when you *do* have conflicting changes)

```bash
git stash push -m "wip: my message"   # shelve tracked changes
git stash push -u -m "wip"            # -u also shelves untracked files
git pull
git stash pop                         # bring them back
git stash list                        # see what's shelved
git stash drop                        # discard the top stash
```

`pop` removes the stash after applying; `git stash apply` keeps it as a safety copy.

### 2.6 Undo & recovery

**Restore a file you deleted or broke (not yet committed):**

```bash
git restore src/test.ts        # bring it back from HEAD
git restore .                  # restore everything ⚠️ discards all unstaged work
```

**Unstage something you `git add`ed too eagerly:**

```bash
git restore --staged <file>
```

**See a file's old content without restoring it:**

```bash
git show HEAD:src/test.ts
git show <commit>:path/to/file
```

**Undo the last commit but keep the changes:**

```bash
git reset --soft HEAD~1     # changes stay staged
git reset HEAD~1            # changes stay in working tree, unstaged
```

**Go back to a known commit, discarding everything after it:**

```bash
git reset --hard <commit>   # ⚠️ destroys uncommitted work too
```

Before any `--hard`, note your current commit (`git log --oneline -1`) so you can get back.

**Find a commit you think you lost:**

```bash
git reflog                  # every position HEAD has held, even "lost" ones
```

`reflog` is the real safety net — almost nothing committed is ever truly gone.

### 2.7 Normal commit flow

```bash
git status                      # review
git diff                        # read your unstaged changes
git add <specific-files>        # stage deliberately
git diff --staged               # read exactly what you're about to commit
git commit -m "clear message"
git push
```

Prefer naming files over `git add .` — it's how stray debug files and `.env` secrets end up
in history.

### 2.8 Branching

```bash
git switch -c my-new-branch      # create + switch (modern)
git switch calvin-phase2         # switch to existing
git checkout -b my-new-branch    # older equivalent of switch -c
git branch -d old-branch         # delete local branch (safe — refuses if unmerged)
```

### 2.9 Merging & conflicts

```bash
git merge origin/Eron
```

If it conflicts, git marks the files and stops. Then:

```bash
git status                # lists "both modified" files
# edit each file, remove the <<<<<<< ======= >>>>>>> markers
git add <resolved-file>
git commit                # completes the merge
```

Bail out mid-merge:

```bash
git merge --abort
```

Conflict markers look like:

```
<<<<<<< HEAD
your version
=======
their version
>>>>>>> origin/Eron
```

Keep whichever is correct — often a hand-written blend of both — and delete all three marker
lines.

### 2.10 Inspecting history

```bash
git log --oneline --graph --all -20      # visual branch topology
git log --follow -- src/test.ts          # history of one file, across renames
git log -p -- <file>                     # history with full diffs
git diff main..calvin-phase2             # compare two branches
git diff --stat main..calvin-phase2      # just the file/line summary
git blame <file>                         # who last changed each line
```

---

## PART 3 — Recipes for our actual situations

**"Eron pushed something, I want it, I have uncommitted work"**

```bash
git fetch origin
git diff --stat HEAD..origin/Eron    # do these files overlap mine?
git pull                             # if no overlap → clean
```

**"I need to pull but we edited the same file"**

```bash
git stash push -u -m "wip"
git pull
git stash pop                        # resolve any conflicts here
```

**"I'm on calvin-phase2 and about to push — will it go to the right place?"**

```bash
git branch -vv                       # check the [bracket]
git push -u origin calvin-phase2     # force it to my own branch
```

**"The app won't start after a pull"**

```bash
git diff HEAD@{1} --name-only | grep package    # did deps change?
npm install
npm --prefix backend install
npm start
```

**"I deleted a file by accident"**

```bash
git status              # confirm it shows " D filename"
git restore <file>
```

**"I want to see what changed since I last pulled"**

```bash
git log --oneline HEAD@{1}..HEAD
git diff HEAD@{1}..HEAD --stat
```

---

## PART 4 — Habits worth keeping

1. **`git status` before and after everything.** Cheap, and it prevents most accidents.
2. **`git fetch` then inspect, before `git pull`.** Fetch is read-only; you always get to look first.
3. **Check `git branch -vv` before pushing.** Especially on `calvin-phase2` (§2.2).
4. **Never `git add .` blindly.** Stage what you mean to stage.
5. **Read `git diff --staged` before committing.** Last chance to catch a stray `console.log`.
6. **Note your commit hash before anything `--hard` or `--force`.** And remember `git reflog`.
7. **`npm install` after pulling dependency changes.** Half of "it's broken on my machine" is this.
8. **Don't commit `node_modules/`, `.env`, or `backend/firebase/service-account.json`.**
