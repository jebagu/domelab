# DomeLab Agent Notes

## Deploy Shortcut

When the user says `deploy`, treat it as this workflow:

1. Commit the current `DomeLab` changes with a clear commit message.
2. Push `main` to `origin`.
3. Watch the GitHub Pages workflow until it finishes successfully.
4. Only then report that the change is live.

## Live Site

- Production URL: `https://jebagu.github.io/domelab/`

## Notes

- The goal of `deploy` is that the user can refresh and see the change immediately after the assistant replies.
- If GitHub Pages is green but the browser still shows the old version, tell the user to hard refresh once.
