/**
 * Channel-side human interactions.
 *
 * `QuestionInteraction*` today; the directory and interface naming leave
 * room for an `ApprovalInteraction` sibling (future) without sharing
 * interfaces prematurely — the official mux already carries
 * `approval/requested` / `approval/resolved` frames.
 */
export * from './question-backend.js';
export * from './question-presenter.js';
export * from './question-state.js';
export * from './question-apiproxy-backend.js';
export * from './question-direct-backend.js';
