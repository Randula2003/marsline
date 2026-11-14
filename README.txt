Marsline Firebase connection button patch

Extract this ZIP into the root of your Marsline project (the directory containing package.json), allowing it to overwrite src/components/mission-console.tsx.

The button now displays a checking state, reports success/failure in a toast, displays detailed API/auth error messages in the status block, and handles non-JSON API responses safely.

Then run: npm run typecheck
