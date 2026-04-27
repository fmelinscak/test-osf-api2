# OSF Submission App

A **frontend-only** web application that lets users enter their name and age, then submits that data as a JSON file to an [Open Science Framework (OSF)](https://osf.io) project.  
Authentication is handled entirely via **OAuth 2.0** (implicit flow) — no backend or server-side code is required.

---

## How It Works

```
User fills form → clicks "Login with OSF" → OSF authenticates the user
  → redirects back with an access token → app uploads a JSON file to the
  configured OSF project storage using WaterButler (OSF's file service)
```

Each submission is stored as a separate JSON file whose name encodes the submitter's OSF user ID and a timestamp (e.g. `submission_abc12_2024-06-01T12-00-00-000Z.json`).  
This design means:

- Every submission gets its own unique file — users **cannot accidentally overwrite** each other's data.
- The app provides **no UI** to list or edit existing submissions, so contributors can only create new ones.
- The project admin retains full control and can view, audit, or delete any file.

---

## Repository Structure

| File | Purpose |
|---|---|
| `index.html` | App markup — form, login/logout buttons, status messages |
| `style.css` | Styling |
| `app.js` | OAuth flow, OSF API calls, form logic |
| `config.js` | **You edit this** — your project ID and OAuth client ID |

---

## Setup Guide

### Step 1 — Create an OSF Project

1. Sign in to [https://osf.io](https://osf.io).
2. Click **"Create new project"**, give it a name, and save.
3. Note the **project GUID** — it is the 5-character code in the URL:  
   `https://osf.io/`**`abc12`**`/` → GUID is **`abc12`**.

> **Visibility**: Keep the project **private** if submissions should only be visible to contributors (recommended). Make it public only if you want anyone to browse the raw files.

---

### Step 2 — Configure Project Permissions

OSF does not have a built-in "append-only" permission mode.  
The closest model that satisfies *"users can only post new submissions, not modify others'"* is:

| Requirement | How it is achieved |
|---|---|
| Users can submit | Add them as contributors with **Write** permission |
| Users cannot see each other's submissions | Keep the project **Private** |
| Users cannot overwrite each other's files | Unique filenames (user ID + timestamp) |
| Users cannot delete files | Only **Admin** contributors can delete files in OSF |
| Admin has full oversight | Project creator retains Admin permission |

**To add a contributor:**

1. Open your OSF project.
2. Go to **Settings → Contributors** (or the **Contributors** tab).
3. Search for the user's OSF account and add them with **Write** permission (not Admin).

Repeat for every participant who will use the app.

> **Tip — Large Studies**: For studies with many participants, consider scripting contributor invitations via the [OSF API](https://developer.osf.io/#tag/Contributors) using an admin token. This cannot be done from the frontend app because it would expose admin credentials.

---

### Step 3 — Register an OSF OAuth2 Application

1. Go to [https://accounts.osf.io/oauth2/applications/](https://accounts.osf.io/oauth2/applications/) (log in if prompted).
2. Click **"New application"**.
3. Fill in the form:

   | Field | Value |
   |---|---|
   | **Application name** | e.g. `Submission App` |
   | **Callback URL** | The exact URL where the app will be hosted (see Step 4) — e.g. `https://yourusername.github.io/test-osf-api2/` |
   | **Application website** | Same as the callback URL |

4. Click **Save**.
5. Copy the **Client ID** (the Client Secret is not needed for this frontend app).

> **Security note**: The Client ID is intentionally public — it is safe to commit to this repository. Never add the Client Secret to any file here.

---

### Step 4 — Configure `config.js`

Edit `config.js` in the repository root and replace the two placeholder values:

```js
const CONFIG = {
  OSF_PROJECT_ID: 'abc12',                   // ← your project GUID
  OSF_CLIENT_ID:  'xxxxxxxxxxxxxxxxxxxxxxxx', // ← your OAuth Client ID
  // leave everything else unchanged
  ...
};
```

Commit and push the change.

---

### Step 5 — Deploy the App

This is a fully static site (HTML + CSS + JS). Hosting options:

#### GitHub Pages (recommended)

1. In the repository, go to **Settings → Pages**.
2. Set **Source** to `Deploy from a branch`, select `main` (or your branch), and folder `/` (root).
3. Save. GitHub will publish the site at  
   `https://<username>.github.io/<repo-name>/`.
4. Make sure this URL exactly matches the **Callback URL** in your OSF OAuth app (Step 3).

#### Other static hosts

Netlify, Vercel, S3 static hosting, or any plain web server work fine.  
The only requirement is that `index.html`, `config.js`, `app.js`, and `style.css` are served from the **same origin**.

---

## Data Format

Each submitted file contains:

```json
{
  "name": "Jane Doe",
  "age": 28,
  "submitted_at": "2024-06-01T12:00:00.000Z",
  "osf_user_id": "abc12"
}
```

Files appear in **OSF Storage** on your project's **Files** tab, where you can download them individually or as a ZIP archive.

---

## Using the App

1. Open the deployed URL in a browser.
2. Click **"Login with OSF"** — you are redirected to OSF to authenticate.
3. After granting access you are returned to the app and your OSF display name appears.
4. Fill in **Name** and **Age**, then click **Submit**.
5. A success message confirms the data was saved. You can click **Logout** when done.

---

## Security Notes

- **Access tokens** are stored in `sessionStorage`, which is cleared automatically when the browser tab or window is closed.
- The OAuth `state` parameter is verified on every callback to prevent CSRF attacks.
- No data is sent to any third-party service; traffic goes only between the browser and `osf.io` / `api.osf.io` / `files.osf.io`.
- If a user's session expires or the token is revoked they are prompted to log in again.

---

## Limitations

- OSF's permission model does not provide true append-only access. Contributors with **Write** permission could technically overwrite files through the OSF web interface or API directly. The combination of unique filenames and the app's restricted UI makes unintentional overwrites essentially impossible.
- For large-scale public data collection (unknown participants), a backend service that holds a single admin token and proxies submissions would be more appropriate.