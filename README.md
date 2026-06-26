# BIPJ-NETS — Ionic Angular App

This is the master template for the NETS mobile app project built with Ionic + Angular.
All teammates must branch off `main` before making any changes.

---

## Project Setup

### Prerequisites
Make sure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or above)
- [Ionic CLI](https://ionicframework.com/docs/cli): `npm install -g @ionic/cli`
- [Git](https://git-scm.com/)
- [VS Code](https://code.visualstudio.com/)

### Clone and Run
```bash
git clone https://github.com/CalvinCode115/BIPJ-NETS.git
cd BIPJ-NETS
npm install
ionic serve
```

> **Logo:** Place `nets-logo.png` into `src/assets/` before running. Ask your team lead for the file.

---

## How to Create Your Own Branch

Each team member must work on their **own branch**. Do **not** commit directly to `main`.

---

### Option A — Using VS Code (Recommended for beginners)

1. Open the project folder in VS Code
2. Click the **branch name** at the bottom-left of VS Code (it will say `main`)
3. A dropdown appears at the top — click **"Create new branch..."**
4. Type your branch name (see naming convention below) and press `Enter`
5. VS Code will automatically switch you to your new branch
6. Make your changes, then go to the **Source Control** panel (Ctrl+Shift+G)
7. Stage your files, write a commit message, click **Commit**
8. Click **Publish Branch** (or the cloud icon) to push to GitHub

---

### Option B — Using Git in the Terminal

```bash
# 1. Make sure you're on the latest main first
git checkout main
git pull origin main

# 2. Create and switch to your new branch
git checkout -b your-branch-name

# 3. After making changes, stage and commit
git add .
git commit -m "Your commit message here"

# 4. Push your branch to GitHub
git push -u origin your-branch-name
```

---

## Branch Naming Convention

Use this format so branches are easy to identify:

```
name/feature-description
```

**Examples:**
```
calvin/home-page
alice/pay-page
bob/rewards-ui
sarah/travel-integration
```

---

## Tab Pages

Each tab has its own folder under `src/app/`. Work only in your assigned page folder.

| Tab | Folder | Route |
|---|---|---|
| Home | `src/app/home/` | `/tabs/home` |
| Pay | `src/app/pay/` | `/tabs/pay` |
| Travel | `src/app/travel/` | `/tabs/travel` |
| Rewards | `src/app/rewards/` | `/tabs/rewards` |
| Payogotchi | `src/app/payogotchi/` | `/tabs/payogotchi` |

---

## Important Rules

- **Never commit directly to `main`** — always use your own branch
- **Do not modify other people's page folders** unless coordinating with them
- Keep `src/app/tabs/` (routing & tab bar) changes coordinated with the team lead
- Run `npm install` after pulling if you see dependency errors
- Run `ionic serve` to preview locally before pushing
