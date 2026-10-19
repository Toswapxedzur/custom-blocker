# Managed rule time

This document describes the timer and rolling-usage API and its linked-state
persistence contract. Verification receipts are maintained separately. Public
publication remains subject to the owner's release hold.

Named objects share the existing per-rule saved-state path. `$vaultTime` is a
reserved versioned namespace; incompatible existing content is refused. Both
object types use stable ASCII IDs and survive Run/restart. Removing a named
object is explicit with `v.removeTime(id)`. There are at most32 objects and64KiB
of total rule state. Invalid/oversized updates report errors rather than erase
saved history. Time durations are integer milliseconds, at most365days.

- `v.timer(id, {direction:"down", durationMs})` or `{direction:"up"}` creates or
  returns a paused named timer. Reusing an ID with another configuration is an
  error. `start()`/`resume()` are idempotent; `pause()` freezes elapsed time;
  `reset()` returns to the initial paused state. `snapshot()` provides
  ready/error, elapsedMs, remainingMs (null for count-up), running and completed.
- `timerEnded` carries `{id,direction:"down",durationMs,generation,incarnation}` once per timer incarnation and generation for each linked member; Run does not replay it.
  Running timers keep wall-clock time while closed/disabled and deliver the
  event when the rule runs again. No JavaScript scheduling capability is added.
- `{type:"timer",timerId:"focus",label:"Focus"}` in `v.panel` uses the current
  timer value, rendered through the existing text control on every platform.
- `v.rolling(id,{windowMs,limitMs})` creates a rolling active-use budget.
  `assign({websites:["youtube.com","reddit.com"],apps:["org.example.game"]})`
  defines targets. Domains include subdomains; native apps use platform IDs.
  `snapshot()` gives usedMs, remainingMs, available and nextReturnAtMs.
  `available(target?)` also checks assignment when a target is supplied.
  `reset()` clears this object's usage only. Exhausting bounded history capacity
  makes the tracker unavailable with `rolling-history-capacity` until reset;
  it never silently ignores new usage and grants a fresh allowance.
- One tracker pools all assigned targets. Separate IDs have independent
  budgets. All observed eligible usage counts even beyond the allowance.
  Overlapping intervals count once. Sparse minute-start→milliseconds buckets
  retain the ordinary representation; merged interval boundaries give exact
  millisecond expiry. Availability returns only below the limit.

Owner-confirmed linked contract: same IDs share across members of one local
linked custom cluster; combine usage/targets, keep initiating timer state,
refuse incompatible configurations, stop shared availability/controls while
disconnected, and deliver completion once to each linked member. The hub retains ordered final snapshots
until each member saves and acknowledges them; failed saves keep shared controls
unavailable. A returning member needs fresh authority before shared controls become ready.

Invalid or oversized event state prevents that event’s actions. A failed disk write preserves the previous saved completion; hosts reload that saved state and retry on a normal tick. Action batches that already began delivery are never replayed. Shared commands retain scoped serials until acknowledgment.

Development verification uses `tests/run.sh --development`; the default also
requires localized guide parity. Batch-translate changed English in-app code
guides across the fixed locale set before any release. The release hold and
default documentation audit remain unchanged.
