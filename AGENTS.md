# DCA AI project rules

## Language

- Use English for all new and edited project content: UI, tooltips, errors, documentation, comments, tests, commit messages, pull requests.
- Conversation with the project owner may be in Russian; respond in the language they use.
- The voice assistant responds in the language the user speaks, switching when the user switches. Translate backend results into that language without changing figures or meaning.
- The in-app text assistant and fixed interface messages remain in English unless requested otherwise.
- Keep this policy until the user explicitly requests a language change or localization.

## Browser workflow

- Test DCA AI (http://localhost:3101/app) and https://app.hyperliquid.xyz/trade in the user's existing Chrome, using Split view: Hyperliquid on the left and DCA AI on the right.
- Reuse an existing pair. Do not create duplicate tabs or break the layout when updating the app.
- Keep the Hyperliquid button as a standard HTTPS link so Chrome can open it in Split view from its context menu. Do not promise that website JavaScript can force Chrome's native layout.
- Never start the microphone automatically. The user starts voice with Start voice.
- Do not change browser-wide startup settings without an explicit request. Recommend Continue where you left off to restore the session.
- Do not trade, sign transactions, or change exchange account settings while testing the interface.
