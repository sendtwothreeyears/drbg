---
status: completed
priority: p1
issue_id: "002"
tags: [ux, error-recovery, frontend]
dependencies: []
---

# User message lost when translation fails on Conversation page

## Problem Statement

In `handleSend()`, the input is cleared (`setMessage("")`) and the user's text is optimistically appended to the messages array BEFORE the API call. If translation fails (502), the textarea is empty and the user's original Twi text is gone. The optimistic message remains in the chat as if it was sent. For a patient typing in Twi — potentially struggling with a non-native keyboard — losing their typed message is a significant UX failure.

## Findings

- `src/client/components/Conversation/index.tsx:117-137` — `setMessage("")` at line 119, optimistic push at line 121
- On catch, error is displayed but the optimistic message is not removed and the input is not restored
- Flagged by architecture and quality review agents

## Proposed Solutions

### Option 1: Roll back optimistic UI and restore input on failure

**Approach:** In the catch block, remove the optimistic message from state and restore the original text to the input.

```typescript
const handleSend = async () => {
  if (!message.trim() || streaming) return;
  const text = message.trim();
  setMessage("");
  setError(null);
  setMessages((prev) => [...prev, { role: "user", content: text }]);
  try {
    await axios.post(`/api/conversation/${conversationId}/message`, {
      message: text,
      language,
    });
    streamResponse();
  } catch (err: any) {
    setMessages((prev) => prev.slice(0, -1));  // remove optimistic message
    setMessage(text);                           // restore input
    if (err.response?.data?.error === "translation_failed") {
      setError("Unable to translate your message. Please try again or switch to English.");
    } else {
      setError("Something went wrong. Please try again.");
    }
  }
};
```

**Pros:**
- User never loses their typed text
- Chat state stays consistent (no phantom sent messages)

**Cons:**
- None significant

**Effort:** 10 minutes

**Risk:** Low

## Recommended Action

Option 1 — add rollback in the catch block.

## Technical Details

**Affected files:**
- `src/client/components/Conversation/index.tsx:116-137` — `handleSend` method

## Acceptance Criteria

- [x] On translation failure, the user's message is restored to the textarea
- [x] The optimistic message bubble is removed from the chat
- [x] Error message is displayed as before
- [x] Successful sends still work with optimistic UI

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Claude Code (code review)

**Actions:**
- Identified during multi-agent code review of feat/language-twi branch
