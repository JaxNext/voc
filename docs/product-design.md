# Product Design: Vocabulary Capture & Review Web App

## 1. Overview

A web app that helps English learners **capture** English sentences, phrases, and words they encounter during daily practice, and **review** them with structured memorization to improve learning retention.

**Target users:** English learners like the founder.
**Platform:** Mobile-first web app, also usable on desktop (PC).
**Core value loop:** Capture → Organize → Review → Progress.

---

## 2. Product Goals

- Lower the friction of saving a new sentence/phrase/word (capture in seconds).
- Make saved records easy to find and organize as the library grows.
- Provide a structured memorization flow (spaced repetition) so users actually retain what they saved.
- Give users a reason to return daily (review queue, streaks, stats).

---

## 3. Core Modules

### 3.1 Account (Auth)

**User story:** Register and log in/log out to keep personal records private and synced across devices.

Features:
- Register (email + password, with email verification)
- Login / Logout
- Password reset
- Persistent session

---

### 3.2 Record (The Entry)

**User story:** Input a sentence, phrase, or word as a record.

**Fields:**
| Field | Required | Notes |
|---|---|---|
| Content | Yes | The sentence / phrase / word itself |
| Type | Yes | `sentence` / `phrase` / `word` |
| Meaning | Yes | Translation or explanation (manual input for now) |
| Source | No | Where it was encountered (video, article, conversation, book…) |
| Notes | No | Usage tips, collocations, personal memory hooks |
| Tags | No | Predefined tags + user-created custom tags (see 3.4) |
| Example sentence | No | *(Nice-to-have; can defer to later phase)* |

---

### 3.3 Record Management

**User story:** View, edit, and delete records.

Features:
- **Record list**: chronological (newest first), paginated or infinite scroll
- **Detail view**: full record with all fields
- **Edit** any field
- **Delete** (with confirmation)
- **Bulk delete** *(later)*

---

### 3.4 Organization & Retrieval

**User story:** Find a specific record quickly as the library grows.

Features:
- **Keyword search** over content and meaning
- **Filter** by type (sentence/phrase/word) and tag
- **Sort**: newest / oldest / alphabetical
- **Tag management**: a predefined tag set (e.g. `work`, `daily`, `idiom`, `travel`) plus ability to create custom tags
- *(Later)* Filter by learning status and by "not yet reviewed"

---

### 3.5 Review (Structured Memorization) — Core Differentiator

**User story:** Review saved items in a structured, memory-friendly way.

Features:
- **Flashcard mode**: show the content, user recalls the meaning, tap to reveal
- **Self-grading**: mark as `Forgot` / `Hazy` / `Know` / `Easy`
- **Learning status**: `New` → `Learning` → `Mastered`
- **Spaced repetition (SRS) scheduling**: items are due for review based on grade, e.g. 1 / 3 / 7 / 14 days (simple intervals at first, can be refined later)
- **Session-based review**: each session presents a fixed number of items (e.g. 10), rather than everything due today
- **Today's review queue**: "N items due today" — the daily anchor that brings users back

**Decisions:**
- SRS starts in V2 with simple fixed intervals based on self-grade; the algorithm can be refined in V3.

---

### 3.6 Progress & Motivation

**User story:** Feel a sense of progress and stay motivated.

Features:
- **Stats dashboard**: total records, mastered count, days reviewed in a row (streak)
- **Random pick / word of the day** *(later)*

---

### 3.7 Data Portability

**User story:** Own my data.

Features:
- **Export** records to JSON *(V3)*

---

## 4. Phasing

| Phase | Scope |
|---|---|
| **MVP** | Auth (register/login/logout, email verification, password reset), record CRUD, record list, search & filter, predefined + custom tags |
| **V2** | Review mode (flashcards + self-grade + learning status), session-based review queue, basic stats (counts, streak) |
| **V3** | Spaced repetition refinement, JSON export, random pick, advanced stats |

---

## 5. Key Decisions

| Topic | Decision |
|---|---|
| Password reset & email verification | In MVP |
| Tag UX | Predefined tags + custom tags |
| Review session style | Session-based (fixed number of items per session) |
| Data export | JSON only |
| SRS algorithm | Start simple (fixed intervals) in V2, refine in V3 |

---

## 6. UI Wireframes (Mobile-first)

All screens below are drawn as mobile (375px) layouts; desktop uses the same screens with a wider content column.

### 6.0 Page Map

```
                    ┌──────────┐
                    │  Login   │
                    └────┬─────┘
                ┌────────┼─────────┐
            ┌───▼───┐ ┌──▼────┐ ┌──▼────────┐
            │Register│ │Reset  │ │Verify     │
            └───┬───┘ │Pwd    │ │Email      │
                │     └───────┘ └───────────┘
        ┌───────▼───────────────┐
        │   App shell (auth'd)  │
        └───┬───┬───────┬───────┘
    ┌───────▼─┐ ┌▼──────┐ ┌▼──────┐ ┌▼────────┐
    │ Records │ │ Add / │ │Review │ │ Stats   │
    │  list   │ │ Edit  │ │(cards)│ │         │
    └───┬─────┘ └───┬───┘ └──┬───┘ └───┬─────┘
        │           │        │         │
    ┌───▼──┐   ┌────▼────┐   │     ┌───▼───┐
    │Detail│   │  Tags   │   │     │  Me / │
    └──────┘   └─────────┘   │     │Settings│
                             │     └───────┘
                        ┌────▼────┐
                        │ Session │
                        │ summary │
                        └─────────┘
```

### 6.1 Auth

**Login**

```text
+-----------------------------+
|  VocabVault                 |
|  Capture. Review. Grow.     |
|                             |
|  Email       [___________]  |
|  Password    [___________]  |
|                             |
|  [       Log in         ]   |
|  Forgot password?          |
|  ──────────── or ────────── |
|  [     Create account   ]   |
+-----------------------------+
```

**Register**

```text
+-----------------------------+
|  ←  Create account          |
|                             |
|  Name        [___________]  |
|  Email       [___________]  |
|  Password    [___________]  |
|  Confirm     [___________]  |
|  (8+ chars, incl. number)   |
|                             |
|  [        Sign up        ]  |
|  Already have an account?   |
|  Log in                     |
+-----------------------------+
```

**Password reset**

```text
+-----------------------------+
|  ←  Reset password          |
|                             |
|  Enter your email and we    |
|  will send a reset link.    |
|                             |
|  Email       [___________]  |
|                             |
|  [    Send reset link    ]  |
|  Back to log in             |
+-----------------------------+
```

**Email verification notice**

```text
+-----------------------------+
|   ✓ Check your inbox        |
|                             |
|  We sent a verification     |
|  link to you@email.com.     |
|  Please verify to activate  |
|  your account.              |
|                             |
|  [ Resend email ]           |
|  [   Continue   ]           |
+-----------------------------+
```

### 6.2 Record List (Home)

```text
+-----------------------------+
|  My Records          [ + ]  |
|  [  Search content or mean…]|
|  (All) (Word) (Phrase)(Sent)|
|  [Tag ▾]        [Newest ▾]  |
|                             |
|  #work  #daily  #idiom  +   |
|                             |
|  ┌───────────────────────┐  |
|  │ "I'm all ears"        │  |
|  │ Phrase · 洗耳恭听        │  |
|  │ #idiom  ·  2d ago      │  |
|  └───────────────────────┘  |
|  ┌───────────────────────┐  |
|  │ Enhance               │  |
|  │ Word · 提升，增强        │  |
|  │ #work  ·  1d ago       │  |
|  └───────────────────────┘  |
|                             |
|  [Records] [Review] [+] [Stats] [Me] |
+-----------------------------+
```

- Type chips filter; tag row = currently active tags (tap to toggle, "+" for tag manager).
- Tap a card → detail. Swipe/长按 → quick delete (later).

### 6.3 Add / Edit Record

```text
+-----------------------------+
|  ←  New record       Save   |
|                             |
|  Type:  (Word)(Phrase)      |
|         (Sentence)          |
|                             |
|  Content  *                 |
|  [_______________________]  |
|                             |
|  Meaning  *                 |
|  [_______________________]  |
|                             |
|  Source (optional)          |
|  [_______________________]  |
|                             |
|  Notes (optional)           |
|  [_______________________]  |
|                             |
|  Tags                       |
|  #work ✕  #idiom ✕         |
|  [ + Add tag ]              |
|                             |
|  * required                 |
+-----------------------------+
```

Edit mode = same form pre-filled with values; title becomes "Edit record".

### 6.4 Record Detail

```text
+-----------------------------+
|  ←              Edit  ⋯    |
|                             |
|        SENTENCE             |
|  ┌───────────────────────┐  |
|  │   "I'm all ears"      │  |
|  └───────────────────────┘  |
|                             |
|  洗耳恭听                    |
|                             |
|  Source   Podcast ep. 12    |
|  Notes    Used when ready   |
|           to listen         |
|  Tags     #idiom  #daily    |
|  Added    Aug 30, 2026      |
|                             |
|  [      Delete record   ]   |
+-----------------------------+
```

### 6.5 Review — Flashcard

**Front (recall)**

```text
+-----------------------------+
|  Review          3 / 10  ✕  |
|  ┌───────────────────────┐  |
|  │                       │  |
|  │   "I'm all ears"      │  |
|  │                       │  |
|  │                       │  |
|  └───────────────────────┘  |
|                             |
|      [ Show meaning ]       |
|                             |
|                             |
+-----------------------------+
```

**Back (self-grade)**

```text
+-----------------------------+
|  Review          3 / 10  ✕  |
|  ┌───────────────────────┐  |
|  │   "I'm all ears"      │  |
|  │   洗耳恭听              │  |
|  │   #idiom              │  |
|  └───────────────────────┘  |
|                             |
|  How well did you know it?  |
|  [Forgot][Hazy][Know][Easy] |
|                             |
|  (4 buttons, 1 tap each)    |
+-----------------------------+
```

- Grade advances the card; next card slides in.
- Session size configurable (default 10), see 6.6.

### 6.6 Review — Session Summary

```text
+-----------------------------+
|   🎉 Session complete!      |
|                             |
|  Reviewed      10           |
|  Forgot         2           |
|  Hazy           3           |
|  Know           4           |
|  Easy           1           |
|                             |
|  New items: 6 ·  Mastered: 1|
|                             |
|  [  Done  ]  [  Again  ]    |
+-----------------------------+
```

### 6.7 Stats Dashboard

```text
+-----------------------------+
|  Progress                   |
|                             |
|  🔥  5-day streak           |
|                             |
|  ┌────────┬────────┬──────┐ |
|  │  128   │  61    │  42  │ |
|  │ Total  │ Learn  │ Master│ |
|  └────────┴────────┴──────┘ |
|                             |
|  Due today: 12              |
|  [     Start review     ]   |
|                             |
|  Reviews this week          |
|  ▓▓ ▓░ ▓▓ ░░ ▓░ ▓▓ ░      |
|  M  T  W  T  F  S  S       |
+-----------------------------+
```

### 6.8 Me / Settings

```text
+-----------------------------+
|  Me                         |
|  ┌───────────────────────┐  |
|  │  👤  you@email.com     │  |
|  │      Member since 2026 │  |
|  └───────────────────────┘  |
|                             |
|  Tags management        >   |
|  Data export (JSON)     >   |
|  Change password        >   |
|  About                   >  |
|  [       Log out        ]   |
+-----------------------------+
```

### 6.9 Tags Management

```text
+-----------------------------+
|  ←  Tags                +   |
|                             |
|  Predefined                 |
|  ◻ work            [x]      |
|  ◻ daily           [x]      |
|  ◻ idiom           [x]      |
|  ◻ travel          [ ]      |
|  Custom                     |
|  ◻ netflix         [x]      |
|  ◻ podcast         [ ]      |
|                             |
|  (checkbox = use in filter; |
|   [x] = delete tag)         |
+-----------------------------+
```

### 6.10 Data Export (JSON)

```text
+-----------------------------+
|  ←  Data export             |
|                             |
|  Export all your records    |
|  as a JSON file.            |
|                             |
|  128 records                |
|  Last exported: never       |
|                             |
|  [    Export JSON       ]   |
+-----------------------------+
```
