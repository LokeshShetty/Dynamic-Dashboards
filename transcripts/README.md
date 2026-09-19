# Session transcripts

AI tools were used to build this project: the work was done in one continuous session with an
assistant, in nine phases, each phase ending with a green `npm run check` and a commit. A second
assistant, which had not seen that session, reviewed the result before it was submitted.

The commit history is the honest summary of what happened: nine feature phases, several
reversals, and the reasons for both. `DESIGN.md` records the decisions, including the ones that
were later undone and why.

Two transcripts are here:

- [build-session.md](build-session.md), the session the repository was built in: 50 messages from
  me, the replies to them, and every tool call named where it happened.
- [independent-review.md](independent-review.md), the second assistant that reviewed the result
  without having seen that session, including the brief it was given.

Both are verbatim apart from one omission: tool **results** are left out. They are file contents,
command output and diffs, and all of it is in this repository and its history already. Nothing
either side said has been edited, so Prettier is kept off these two files: a record that has been
reformatted is no longer the record.
