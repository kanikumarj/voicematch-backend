-- matchmaking_pair.lua
-- Atomically pop two userIds from the searching_pool LIST.
-- Returns an empty array if pool has < 2 entries.
-- This prevents the race condition where two sequential RPOPs
-- interleave with a concurrent LPUSH from a third user.

local key   = KEYS[1]
local count = redis.call('LLEN', key)

if count < 2 then
  return {}
end

local a = redis.call('RPOP', key)
local b = redis.call('RPOP', key)

-- Guard: if either pop returned nil (shouldn't happen, but Redis can be quirky)
if not a or not b then
  if a then redis.call('LPUSH', key, a) end
  if b then redis.call('LPUSH', key, b) end
  return {}
end

return {a, b}
