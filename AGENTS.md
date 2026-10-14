# CoachLab development and learning requirements

Work in small, reviewable steps. Explain the purpose of a change in beginner-friendly language before making it. Follow the phase boundaries in PROMPT_LOG.md; Phase 3 has not been approved. Do not push without the user's approval.

After each verified development step:

1. Append the actual user development prompt and the assistant's response/outcome to PROMPT_LOG.md. Preserve prior entries. Distinguish verbatim text from summaries. Record date, requested work, changed files, actual checks/results, errors/corrections, and commit references. Do not invent unavailable history, approvals, tests, or mistakes. Use “Historical prompt unavailable — summary reconstructed.” when exact historical prompt text is unavailable.
2. Update CODE_WALKTHROUGH.md for every added or modified application source/configuration line. Include the exact path, numbered code, an explanation for each line (including syntax and delimiters), and how it connects to existing code. Include SQL migrations when they exist. Generated files, dependency lockfiles, and node_modules are excluded.
3. Compare all numbered listings and explanation coverage against current files. Review the explanation meanings, not just their line counts. Never claim tests or explanations are complete without checking.
4. Record genuine AI mistakes and their discovery, correction, and verification. Do not intentionally create a bug for the assignment.
5. Review Git status and every diff; verify that secrets, private environment files, databases, generated dependencies, and unrelated work are not staged. Commit verified code and its documentation together in small commits. A commit cannot contain its own hash; identify the containing commit by subject and record its resolved hash in the next authorized log update.

Keep SQLite outside OneDrive. Do not modify neighboring projects. Keep production code readable without excessive explanatory comments; put the detailed teaching material in the walkthrough.
